import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

from ..scheduler.events import EVENT_BUS
from ..scheduler.models import JobStatus
from ..scheduler.reporter import ProgressReporter
from ..scheduler.store import JOB_STORE
from ..scheduler.worker import enqueue_job, get_queue_position
from ..uir.builder import build_uir_from_prompt

router = APIRouter()
_LOGS_TAIL_LIMIT = 8
_TERMINAL_STATUSES = {JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELED}


def _progress_percent(value: Any) -> float:
    try:
        progress = float(value)
    except (TypeError, ValueError):
        return 0.0
    if progress <= 1.0:
        progress *= 100.0
    return max(0.0, min(100.0, progress))


def _logs_tail(lines: List[str], limit: int = _LOGS_TAIL_LIMIT) -> List[str]:
    if limit <= 0:
        return []
    if len(lines) <= limit:
        return list(lines)
    return list(lines[-limit:])


def _job_to_dict(job: Any) -> Dict[str, Any]:
    logs = list(job.logs)
    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "stage": job.stage,
        "progress": _progress_percent(job.progress),
        "message": job.message,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
        "uir": job.uir,
        "uir_hash": job.uir_hash,
        "manifest_path": job.manifest_path,
        "manifest_url": job.manifest_url,
        "stages": list(job.stages),
        "queue_position": get_queue_position(job.job_id),
        "logs": logs,
        "logs_tail": _logs_tail(logs),
        "assets": dict(job.assets),
    }


def _format_sse(event_name: str, data: Dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_name}\ndata: {payload}\n\n"


def _looks_like_prompt_payload(payload: Dict[str, Any]) -> bool:
    if "uir_version" in payload:
        return False
    return "prompt" in payload or "options" in payload


@router.post("")
async def create_job(payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="payload must be a JSON object")
    uir = payload
    if _looks_like_prompt_payload(payload):
        prompt = payload.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise HTTPException(status_code=422, detail="prompt is required")
        options = payload.get("options")
        if not isinstance(options, dict):
            options = {}
        try:
            uir = build_uir_from_prompt(prompt, options)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        job = JOB_STORE.create_job(uir or {})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    queue_position = await enqueue_job(job.job_id)
    return {"job_id": job.job_id, "queue_position": queue_position}


@router.get("/{job_id}")
async def get_job(job_id: str) -> Dict[str, Any]:
    job = JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_dict(job)


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str, payload: Optional[Dict[str, Any]] = Body(default=None)
) -> Dict[str, Any]:
    if payload is not None and not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="payload must be a JSON object")
    message = "canceled"
    if isinstance(payload, dict):
        raw_message = payload.get("message")
        if isinstance(raw_message, str) and raw_message.strip():
            message = raw_message.strip()
    job = JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status in _TERMINAL_STATUSES:
        return _job_to_dict(job)
    job = JOB_STORE.cancel_job(job_id, message=message)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != JobStatus.CANCELED:
        return _job_to_dict(job)
    reporter = ProgressReporter(job_id, JOB_STORE, EVENT_BUS)
    await reporter.status(JobStatus.CANCELED, job.progress, message)
    job = JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_dict(job)


@router.get("/{job_id}/events")
async def job_events(job_id: str) -> StreamingResponse:
    job = JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    async def event_stream() -> Any:
        queue = await EVENT_BUS.subscribe(job_id)
        try:
            snapshot = JOB_STORE.get_job(job_id)
            if snapshot:
                yield _format_sse("status", _job_to_dict(snapshot))
            while True:
                event = await queue.get()
                yield _format_sse(event["event"], event["data"])
        finally:
            await EVENT_BUS.unsubscribe(job_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
