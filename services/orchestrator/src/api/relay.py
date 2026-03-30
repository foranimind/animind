from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from ..config.relay import get_relay_settings
from ..config.runtime import get_runtime_paths
from ..scheduler.store import JOB_STORE
from ..storage.manifest import make_asset_url, write_manifest

router = APIRouter()


@router.post("/{job_id}/relay-upload")
async def relay_upload(
    job_id: str,
    manifest: str = Form(...),
    files: List[UploadFile] = File(...),
    x_relay_token: str | None = Header(default=None),
) -> Dict[str, Any]:
    settings = get_relay_settings()
    if not settings.token or x_relay_token != settings.token:
        raise HTTPException(status_code=403, detail="invalid relay token")

    job = JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    entries = _parse_manifest(manifest)
    if len(entries) != len(files):
        raise HTTPException(status_code=422, detail="manifest/files length mismatch")

    runtime = get_runtime_paths()
    job_root = runtime.assets_dir / job_id
    job_root.mkdir(parents=True, exist_ok=True)
    planned = [
        _validated_upload(job_root, entry, upload)
        for entry, upload in zip(entries, files, strict=True)
    ]

    artifacts: List[Dict[str, Any]] = []
    for entry, upload, relative_path, target in planned:
        target.parent.mkdir(parents=True, exist_ok=True)
        data = await upload.read()
        target.write_bytes(data)
        artifacts.append(
            {
                "id": f"{job_id}:{entry['role']}",
                "role": entry["role"],
                "uri": make_asset_url(job_id, relative_path.as_posix()),
                "mime": entry.get("mime") or upload.content_type,
                "bytes": len(data),
            }
        )

    merged_artifacts = _merge_artifacts(job.assets, artifacts)
    assets = dict(job.assets) if isinstance(job.assets, dict) else {}
    assets["artifacts"] = merged_artifacts
    JOB_STORE.update_job(job_id, assets=assets)
    job = JOB_STORE.get_job(job_id)
    if job:
        write_manifest(job_root, job.uir, job.status.value, merged_artifacts, [])
        JOB_STORE.update_job(
            job_id,
            manifest_path=str(job_root / "manifest.json"),
            manifest_url=make_asset_url(job_id, "manifest.json"),
        )

    return {"job_id": job_id, "artifacts": artifacts}


def _parse_manifest(manifest: str) -> List[Dict[str, Any]]:
    try:
        payload = json.loads(manifest)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="manifest must be valid JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="manifest must be a list")
    entries: List[Dict[str, Any]] = []
    for entry in payload:
        if not isinstance(entry, dict):
            raise HTTPException(status_code=422, detail="manifest entries must be objects")
        role = entry.get("role")
        relative_path = entry.get("relative_path")
        if not isinstance(role, str) or not role.strip():
            raise HTTPException(status_code=422, detail="manifest role is required")
        if not isinstance(relative_path, str) or not relative_path.strip():
            raise HTTPException(status_code=422, detail="manifest relative_path is required")
        entries.append(
            {
                "role": role.strip(),
                "relative_path": relative_path.strip(),
                "mime": entry.get("mime"),
            }
        )
    return entries


def _validated_upload(
    job_root: Path,
    entry: Dict[str, Any],
    upload: UploadFile,
) -> Tuple[Dict[str, Any], UploadFile, Path, Path]:
    relative_path = Path(entry["relative_path"].replace("\\", "/"))
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise HTTPException(status_code=422, detail="relative_path must stay under the job directory")
    if not relative_path.name:
        raise HTTPException(status_code=422, detail="relative_path must include a filename")
    if upload.filename != relative_path.name:
        raise HTTPException(status_code=422, detail="upload filename must match manifest relative_path")
    target = (job_root / relative_path).resolve()
    job_root_resolved = job_root.resolve()
    if target != job_root_resolved and job_root_resolved not in target.parents:
        raise HTTPException(status_code=422, detail="relative_path must stay under the job directory")
    return entry, upload, relative_path, target


def _merge_artifacts(existing_assets: Any, new_artifacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    if isinstance(existing_assets, dict):
        stored = existing_assets.get("artifacts")
        if isinstance(stored, list):
            merged.extend([item for item in stored if isinstance(item, dict)])
    merged.extend(new_artifacts)
    return merged
