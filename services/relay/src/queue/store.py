from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from ..config.runtime import get_runtime_paths

_TASKS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()


def create_task_record(payload: dict) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")
    job_id = _required_str(payload.get("job_id"), "job_id")
    kind = _required_str(payload.get("kind"), "kind")
    record = {
        "task_id": f"task_{uuid4().hex}",
        "job_id": job_id,
        "kind": kind,
        "status": "queued",
        "progress": 0.0,
        "input": _coerce_dict(payload.get("input")),
        "options": _coerce_dict(payload.get("options")),
        "artifacts": [],
        "error": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    return save_task_record(record)


def save_task_record(record: Dict[str, Any]) -> Dict[str, Any]:
    task_id = _required_str(record.get("task_id"), "task_id")
    payload = dict(record)
    payload["task_id"] = task_id
    payload["updated_at"] = _now_iso()
    with _LOCK:
        _TASKS[task_id] = payload
    _write_record(payload)
    return dict(payload)


def update_task_record(task_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
    record = get_task_record(task_id)
    if record is None:
        return None
    updated = dict(record)
    updated.update(fields)
    return save_task_record(updated)


def get_task_record(task_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        record = _TASKS.get(task_id)
        if record is not None:
            return dict(record)
    path = _record_path(task_id)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    with _LOCK:
        _TASKS[task_id] = dict(payload)
    return dict(payload)


def _write_record(record: Dict[str, Any]) -> None:
    path = _record_path(record["task_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, ensure_ascii=True, indent=2), encoding="utf-8")


def _record_path(task_id: str) -> Path:
    runtime = get_runtime_paths()
    return runtime.tasks_dir / task_id / "record.json"


def _required_str(value: Any, field_name: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise ValueError(f"{field_name} is required")


def _coerce_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
