from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Header, HTTPException

from ..config.settings import get_settings
from ..queue.store import create_task_record, get_task_record

router = APIRouter()


@router.post("/tasks", status_code=202)
def create_task(
    payload: Dict[str, Any],
    x_relay_token: str | None = Header(default=None),
) -> Dict[str, Any]:
    _assert_token(x_relay_token)
    try:
        return create_task_record(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/tasks/{task_id}")
def get_task(task_id: str, x_relay_token: str | None = Header(default=None)) -> Dict[str, Any]:
    _assert_token(x_relay_token)
    record = get_task_record(task_id)
    if record is None:
        raise HTTPException(status_code=404, detail="task not found")
    return record


def _assert_token(value: str | None) -> None:
    if value != get_settings().token:
        raise HTTPException(status_code=403, detail="invalid relay token")
