from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from .models import Job, JobStatus
from ..config.runtime import get_runtime_paths
from ..planner import plan_stages
from ..storage.job_fs import ensure_job_dirs, write_uir
from ..storage.jobs_db import init_db, load_jobs, upsert_job
from ..storage.manifest import make_asset_url, write_manifest
from ..uir import parse_uir, stable_hash

_TERMINAL_STATUSES = {JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELED}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_job_id(value: Any) -> Optional[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return None


def _ensure_job_metadata(payload: Dict[str, Any], job_id: str) -> Dict[str, Any]:
    enriched = dict(payload)
    job = enriched.get("job")
    if not isinstance(job, dict):
        job = {}
    if not _coerce_job_id(job.get("id")):
        job["id"] = job_id
    created_at = job.get("created_at")
    if not created_at or (isinstance(created_at, str) and not created_at.strip()):
        job["created_at"] = _now().isoformat()
    enriched["job"] = job
    return enriched


class JobStore:
    def __init__(self, max_log_lines: int = 200) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._max_log_lines = max_log_lines
        self._runtime_key: Optional[str] = None
        self._db_path: Optional[Path] = None
        with self._lock:
            self._sync_runtime_locked()

    def sync_runtime(self) -> None:
        with self._lock:
            self._sync_runtime_locked()

    def create_job(self, uir: Dict[str, Any]) -> Job:
        if not isinstance(uir, dict):
            raise ValueError("UIR payload must be a JSON object")
        self.sync_runtime()
        supplied_id = None
        job_section = uir.get("job") if isinstance(uir, dict) else None
        if isinstance(job_section, dict):
            supplied_id = _coerce_job_id(job_section.get("id"))
        job_id = supplied_id or uuid4().hex
        uir_model = parse_uir(_ensure_job_metadata(uir, job_id))
        uir_payload = json.loads(uir_model.json(by_alias=True, exclude_none=True))
        job_id = _coerce_job_id(uir_payload.get("job", {}).get("id")) or job_id
        uir_digest = stable_hash(uir_model)
        stage_plan = plan_stages(uir_payload)
        job = Job(
            job_id=job_id,
            uir=uir_payload,
            uir_hash=uir_digest,
            status=JobStatus.QUEUED,
            stages=stage_plan,
        )
        runtime_paths = get_runtime_paths()
        job_dir = ensure_job_dirs(runtime_paths.assets_dir, job_id)
        write_uir(job_dir, uir_payload)
        write_manifest(job_dir, uir_payload, job.status.value, [], [])
        job.manifest_path = str(job_dir / "manifest.json")
        job.manifest_url = make_asset_url(job_id, "manifest.json")
        with self._lock:
            self._sync_runtime_locked()
            self._jobs[job_id] = job
            self._persist_locked(job)
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self, status: Optional[JobStatus] = None) -> List[Job]:
        with self._lock:
            if status is None:
                return list(self._jobs.values())
            return [job for job in self._jobs.values() if job.status == status]

    def update_job(self, job_id: str, **fields: Any) -> Optional[Job]:
        with self._lock:
            self._sync_runtime_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            if "status" in fields:
                value = fields.get("status")
                if isinstance(value, str):
                    value = JobStatus(value)
                if not isinstance(value, JobStatus):
                    raise ValueError(f"Invalid status: {value!r}")
                if job.status in _TERMINAL_STATUSES and job.status != value:
                    return job
                job.status = value
                if "stage" not in fields:
                    job.stage = value.value
                if job.started_at is None and value != JobStatus.QUEUED:
                    job.started_at = _now()
                if value in _TERMINAL_STATUSES and job.ended_at is None:
                    job.ended_at = _now()
            for key, value in fields.items():
                if key == "status":
                    continue
                if key == "progress" and isinstance(value, (int, float)):
                    value = max(0.0, min(1.0, float(value)))
                if hasattr(job, key):
                    setattr(job, key, value)
            self._persist_locked(job)
            return job

    def append_log(self, job_id: str, line: str) -> Optional[Job]:
        with self._lock:
            self._sync_runtime_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            job.logs.append(line)
            overflow = len(job.logs) - self._max_log_lines
            if overflow > 0:
                del job.logs[:overflow]
            self._persist_locked(job)
            return job

    def set_asset(
        self,
        job_id: str,
        kind: str,
        value: Any,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Optional[Job]:
        with self._lock:
            self._sync_runtime_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            assets = dict(job.assets)
            _assign_asset(assets, kind, value, meta)
            job.assets = assets
            self._persist_locked(job)
            return job

    def cancel_job(self, job_id: str, message: str = "canceled") -> Optional[Job]:
        with self._lock:
            self._sync_runtime_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            if job.status in _TERMINAL_STATUSES:
                return job
            job.status = JobStatus.CANCELED
            job.stage = JobStatus.CANCELED.value
            job.message = message
            if job.started_at is None:
                job.started_at = _now()
            if job.ended_at is None:
                job.ended_at = _now()
            self._persist_locked(job)
            return job

    def _sync_runtime_locked(self) -> None:
        runtime_paths = get_runtime_paths()
        runtime_key = str(runtime_paths.runtime_dir)
        if self._runtime_key == runtime_key and self._db_path is not None:
            return
        self._runtime_key = runtime_key
        self._db_path = runtime_paths.runtime_dir / "jobs.db"
        init_db(self._db_path)
        snapshots = load_jobs(self._db_path)
        jobs: Dict[str, Job] = {}
        for payload in snapshots.values():
            job = _job_from_snapshot(payload)
            if job is not None:
                jobs[job.job_id] = job
        self._jobs = jobs

    def _persist_locked(self, job: Job) -> None:
        if self._db_path is None:
            self._sync_runtime_locked()
        assert self._db_path is not None
        upsert_job(self._db_path, job.job_id, _job_snapshot(job))


JOB_STORE = JobStore()


def _assign_asset(
    assets: Dict[str, Any],
    kind: str,
    value: Any,
    meta: Optional[Dict[str, Any]],
) -> None:
    parts = kind.split(".", 1)
    if len(parts) == 2:
        category, field = parts
        bucket = assets.get(category)
        if not isinstance(bucket, dict):
            bucket = {}
        bucket[field] = value
        if meta:
            bucket.update(meta)
        assets[category] = bucket
        return
    if meta:
        entry = {"value": value}
        entry.update(meta)
        assets[kind] = entry
    else:
        assets[kind] = value


def _job_snapshot(job: Job) -> Dict[str, Any]:
    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "stage": job.stage,
        "progress": job.progress,
        "message": job.message,
        "created_at": _datetime_to_iso(job.created_at),
        "started_at": _datetime_to_iso(job.started_at),
        "ended_at": _datetime_to_iso(job.ended_at),
        "uir": job.uir,
        "uir_hash": job.uir_hash,
        "manifest_path": job.manifest_path,
        "manifest_url": job.manifest_url,
        "stages": list(job.stages),
        "logs": list(job.logs),
        "assets": dict(job.assets),
    }


def _job_from_snapshot(payload: Any) -> Optional[Job]:
    if not isinstance(payload, dict):
        return None
    job_id = _coerce_job_id(payload.get("job_id"))
    if not job_id:
        return None
    status = _coerce_status(payload.get("status")) or JobStatus.QUEUED
    return Job(
        job_id=job_id,
        status=status,
        stage=_coerce_str(payload.get("stage")) or status.value,
        progress=_coerce_progress(payload.get("progress")),
        message=_coerce_str(payload.get("message")) or "",
        created_at=_coerce_datetime(payload.get("created_at")) or _now(),
        started_at=_coerce_datetime(payload.get("started_at")),
        ended_at=_coerce_datetime(payload.get("ended_at")),
        uir=_coerce_dict(payload.get("uir")),
        uir_hash=_coerce_str(payload.get("uir_hash")) or "",
        manifest_path=_coerce_str(payload.get("manifest_path")),
        manifest_url=_coerce_str(payload.get("manifest_url")),
        stages=_coerce_str_list(payload.get("stages")),
        logs=_coerce_str_list(payload.get("logs")),
        assets=_coerce_dict(payload.get("assets")),
    )


def _datetime_to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat()


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _coerce_status(value: Any) -> Optional[JobStatus]:
    if isinstance(value, JobStatus):
        return value
    if isinstance(value, str):
        try:
            return JobStatus(value)
        except ValueError:
            return None
    return None


def _coerce_progress(value: Any) -> float:
    try:
        progress = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, progress))


def _coerce_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    return None


def _coerce_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def _coerce_str_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
