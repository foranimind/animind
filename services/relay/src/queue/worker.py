from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from ..executors import dispatch
from ..upload import orchestrator as orchestrator_upload
from .store import save_task_record, update_task_record


def run_single_task(task: Dict[str, Any], runtime_dir: Path) -> Dict[str, Any]:
    record = save_task_record(dict(task))
    task_id = str(record["task_id"])
    job_id = str(record["job_id"])
    task_root = Path(runtime_dir) / task_id
    task_root.mkdir(parents=True, exist_ok=True)
    update_task_record(task_id, status="running", progress=0.1)
    try:
        artifacts = dispatch.run_executor(record, task_root)
        uploaded = orchestrator_upload.upload_artifacts(
            job_id, artifacts, task_root / job_id
        )
    except Exception as exc:
        failed = update_task_record(
            task_id,
            status="failed",
            progress=1.0,
            error={"code": "E_MODEL_RUNTIME", "message": str(exc)},
        )
        return failed or record
    succeeded = update_task_record(
        task_id,
        status="succeeded",
        progress=1.0,
        artifacts=uploaded.get("artifacts", artifacts),
        error=None,
    )
    return succeeded or record
