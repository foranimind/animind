from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict, List

from .base import AdapterCanceled, AdapterResult, BaseAdapter, build_error
from .relay_client import RelayClient
from ..storage.manifest import make_asset_url


class RemoteMotionAdapter(BaseAdapter):
    provider_id = "animationgpt_relay"
    modality = "motion"
    max_concurrency = 1

    def run(
        self, uir: Dict[str, Any], out_dir: Path, reporter: Any
    ) -> AdapterResult:
        del out_dir
        job_id = _job_id_from_uir(uir)
        motion = _module(uir, "motion")
        client = RelayClient()
        created = client.create_task(
            {
                "job_id": job_id,
                "kind": "motion",
                "input": {"prompt": motion.get("prompt", "")},
                "options": {
                    "fps": motion.get("fps", 30),
                    "duration_s": motion.get("duration_s"),
                },
            }
        )
        task_id = str(created["task_id"])
        _check_canceled(reporter)
        while True:
            state = client.get_task(task_id)
            status = str(state.get("status") or "running")
            reporter.stage(status, _progress(state.get("progress")), "relay motion")
            _check_canceled(reporter)
            if status == "failed":
                return _failure_result(self.provider_id, task_id, state)
            if status == "succeeded":
                return _success_result(self.provider_id, job_id, task_id, state)
            time.sleep(1.0)


def _job_id_from_uir(uir: Dict[str, Any]) -> str:
    job = uir.get("job")
    if isinstance(job, dict) and job.get("id"):
        return str(job["id"])
    raise ValueError("missing job.id")


def _module(uir: Dict[str, Any], name: str) -> Dict[str, Any]:
    modules = uir.get("modules")
    if isinstance(modules, dict):
        section = modules.get(name)
        if isinstance(section, dict):
            return section
    return {}


def _progress(value: Any) -> float:
    try:
        progress = float(value)
    except (TypeError, ValueError):
        return 0.0
    if progress > 1.0:
        progress /= 100.0
    return max(0.0, min(1.0, progress))


def _success_result(
    provider_id: str,
    job_id: str,
    task_id: str,
    state: Dict[str, Any],
) -> AdapterResult:
    artifacts: List[Dict[str, Any]] = []
    for item in state.get("artifacts", []):
        if not isinstance(item, dict):
            continue
        relative_path = item.get("relative_path")
        role = item.get("role")
        if not isinstance(relative_path, str) or not relative_path.strip():
            continue
        if not isinstance(role, str) or not role.strip():
            continue
        artifact: Dict[str, Any] = {
            "id": f"{job_id}:{role}",
            "role": role,
            "uri": make_asset_url(job_id, relative_path.strip()),
        }
        if item.get("mime") is not None:
            artifact["mime"] = item.get("mime")
        if item.get("bytes") is not None:
            artifact["bytes"] = item.get("bytes")
        artifacts.append(artifact)
    return {
        "ok": True,
        "provider": provider_id,
        "artifacts": artifacts,
        "meta": {"task_id": task_id},
        "warnings": [],
        "error": None,
    }


def _failure_result(provider_id: str, task_id: str, state: Dict[str, Any]) -> AdapterResult:
    error = state.get("error")
    code = "E_MODEL_RUNTIME"
    message = "relay motion failed"
    retryable = True
    if isinstance(error, dict):
        raw_code = error.get("code")
        raw_message = error.get("message")
        if isinstance(raw_code, str) and raw_code:
            code = raw_code
        if isinstance(raw_message, str) and raw_message:
            message = raw_message
        if error.get("retryable") is not None:
            retryable = bool(error.get("retryable"))
    detail = dict(state)
    detail["task_id"] = task_id
    return {
        "ok": False,
        "provider": provider_id,
        "artifacts": [],
        "meta": {"task_id": task_id},
        "warnings": [],
        "error": build_error(code, message, detail=detail, retryable=retryable),
    }


def _check_canceled(reporter: Any) -> None:
    token = getattr(reporter, "cancel_token", None)
    if token is not None and token.is_canceled():
        raise AdapterCanceled("adapter canceled")
    is_canceled = getattr(reporter, "is_canceled", None)
    if callable(is_canceled) and is_canceled():
        raise AdapterCanceled("adapter canceled")
