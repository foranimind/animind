from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict

from .base import AdapterResult, BaseAdapter
from .relay_client import RelayClient
from .remote_motion import (
    _check_canceled,
    _failure_result,
    _job_id_from_uir,
    _module,
    _progress,
    _success_result,
)


class RemoteMusicAdapter(BaseAdapter):
    provider_id = "musicgpt_relay"
    modality = "music"
    max_concurrency = 1

    def run(
        self, uir: Dict[str, Any], out_dir: Path, reporter: Any
    ) -> AdapterResult:
        del out_dir
        job_id = _job_id_from_uir(uir)
        music = _module(uir, "music")
        client = RelayClient()
        created = client.create_task(
            {
                "job_id": job_id,
                "kind": "music",
                "input": {"prompt": music.get("prompt", "")},
                "options": {"duration_s": music.get("duration_s")},
            }
        )
        task_id = str(created["task_id"])
        _check_canceled(reporter)
        while True:
            state = client.get_task(task_id)
            status = str(state.get("status") or "running")
            reporter.stage(status, _progress(state.get("progress")), "relay music")
            _check_canceled(reporter)
            if status == "failed":
                return _failure_result(self.provider_id, task_id, state)
            if status == "succeeded":
                return _success_result(self.provider_id, job_id, task_id, state)
            time.sleep(1.0)
