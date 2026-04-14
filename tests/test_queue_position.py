import asyncio
import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import List
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.orchestrator.src.api.jobs import create_job, get_job
from services.orchestrator.src.scheduler.events import EVENT_BUS
from services.orchestrator.src.scheduler.models import JobStatus
from services.orchestrator.src.scheduler.reporter import ProgressReporter
from services.orchestrator.src.scheduler.store import JOB_STORE
from services.orchestrator.src.scheduler.worker import _reset_queue_state, enqueue_job


def _base_uir(job_id: str) -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "queue test", "lang": "en"},
        "intent": {"targets": ["scene"], "duration_s": 12},
        "modules": {
            "scene": {"enabled": False},
            "motion": {"enabled": False},
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestQueuePosition(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._runtime_dir = TemporaryDirectory()
        self._old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
        os.environ["ORCH_RUNTIME_DIR"] = self._runtime_dir.name
        self._job_ids: List[str] = []
        _reset_queue_state()

    def tearDown(self) -> None:
        with JOB_STORE._lock:
            for job_id in self._job_ids:
                JOB_STORE._jobs.pop(job_id, None)
        _reset_queue_state()
        if self._old_runtime_dir is None:
            os.environ.pop("ORCH_RUNTIME_DIR", None)
        else:
            os.environ["ORCH_RUNTIME_DIR"] = self._old_runtime_dir
        self._runtime_dir.cleanup()

    async def test_create_and_get_job_expose_queue_position(self) -> None:
        first_job_id = f"job_{uuid4().hex}"
        second_job_id = f"job_{uuid4().hex}"
        self._job_ids.extend([first_job_id, second_job_id])

        first_response = await create_job(_base_uir(first_job_id))
        second_response = await create_job(_base_uir(second_job_id))
        first_status = await get_job(first_job_id)
        second_status = await get_job(second_job_id)

        self.assertEqual(first_response["queue_position"], 1)
        self.assertEqual(second_response["queue_position"], 2)
        self.assertEqual(first_status["queue_position"], 1)
        self.assertEqual(second_status["queue_position"], 2)

    async def test_status_events_include_queue_position(self) -> None:
        job_id = f"job_{uuid4().hex}"
        self._job_ids.append(job_id)
        JOB_STORE.create_job(_base_uir(job_id))
        await enqueue_job(job_id)

        queue = await EVENT_BUS.subscribe(job_id)
        try:
            reporter = ProgressReporter(job_id, JOB_STORE, EVENT_BUS)
            await reporter.status(JobStatus.PLANNING, 0.0, "planning")
            event = await asyncio.wait_for(queue.get(), timeout=1.0)
        finally:
            await EVENT_BUS.unsubscribe(job_id, queue)

        self.assertEqual(event["event"], "status")
        self.assertEqual(event["data"]["queue_position"], 1)


if __name__ == "__main__":
    unittest.main()
