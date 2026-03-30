from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import httpx

from ..config.settings import get_settings


def upload_artifacts(job_id: str, artifacts: List[Dict[str, Any]], task_root: Path) -> Dict[str, Any]:
    settings = get_settings()
    manifest = [
        {
            "role": item["role"],
            "relative_path": item["relative_path"],
            "mime": item.get("mime"),
        }
        for item in artifacts
    ]
    files = []
    for item in artifacts:
        relative_path = Path(item["relative_path"])
        file_path = Path(task_root) / relative_path
        files.append(
            (
                "files",
                (
                    relative_path.name,
                    file_path.read_bytes(),
                    item.get("mime") or "application/octet-stream",
                ),
            )
        )
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{settings.orchestrator_base_url}/api/jobs/{job_id}/relay-upload",
            data={"manifest": json.dumps(manifest, ensure_ascii=True)},
            files=files,
            headers={"X-Relay-Token": settings.orchestrator_token},
        )
        response.raise_for_status()
        return response.json()
