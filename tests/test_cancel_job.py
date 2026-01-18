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

from fastapi import HTTPException

from services.orchestrator.src.api.jobs import cancel_job
from services.orchestrator.src.scheduler.events import EVENT_BUS
from services.orchestrator.src.scheduler.models import JobStatus
from services.orchestrator.src.scheduler.store import JOB_STORE


def _base_uir(job_id: str) -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "test prompt", "lang": "en"},
        "intent": {"targets": ["scene"], "duration_s": 12},
        "modules": {
            "scene": {
                "enabled": True,
                "prompt": "panorama scene",
                "resolution": [1024, 512],
            },
            "motion": {"enabled": False},
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestCancelJobApi(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._runtime_dir = TemporaryDirectory()
        self._old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
        os.environ["ORCH_RUNTIME_DIR"] = self._runtime_dir.name
        self._job_ids: List[str] = []

    def tearDown(self) -> None:
        with JOB_STORE._lock:
            for job_id in self._job_ids:
                JOB_STORE._jobs.pop(job_id, None)
        if self._old_runtime_dir is None:
            os.environ.pop("ORCH_RUNTIME_DIR", None)
        else:
            os.environ["ORCH_RUNTIME_DIR"] = self._old_runtime_dir
        self._runtime_dir.cleanup()

    def _create_job(self) -> str:
        job_id = f"job_{uuid4().hex}"
        JOB_STORE.create_job(_base_uir(job_id))
        self._job_ids.append(job_id)
        return job_id

    async def test_cancel_job_broadcasts_status(self) -> None:
        job_id = self._create_job()
        queue = await EVENT_BUS.subscribe(job_id)
        try:
            response = await cancel_job(job_id, payload={"message": "user canceled"})
            self.assertEqual(response["status"], "CANCELED")
            self.assertEqual(response["stage"], "CANCELED")
            self.assertEqual(response["message"], "user canceled")

            event = await asyncio.wait_for(queue.get(), timeout=1.0)
            self.assertEqual(event["event"], "status")
            data = event["data"]
            self.assertEqual(data["status"], "CANCELED")
            self.assertEqual(data["stage"], "CANCELED")
            self.assertEqual(data["message"], "user canceled")
        finally:
            await EVENT_BUS.unsubscribe(job_id, queue)

    async def test_cancel_job_is_idempotent(self) -> None:
        job_id = self._create_job()
        await cancel_job(job_id, payload={"message": "first cancel"})
        response = await cancel_job(job_id, payload={"message": "second cancel"})
        self.assertEqual(response["status"], "CANCELED")
        self.assertEqual(response["message"], "first cancel")

    async def test_cancel_job_on_terminal_returns_existing(self) -> None:
        job_id = self._create_job()
        JOB_STORE.update_job(job_id, status=JobStatus.DONE, message="done")
        response = await cancel_job(job_id, payload={"message": "ignored"})
        self.assertEqual(response["status"], "DONE")
        self.assertEqual(response["message"], "done")

    async def test_cancel_job_missing_returns_404(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await cancel_job("missing_job", payload=None)
        self.assertEqual(context.exception.status_code, 404)


class TestJobStoreTerminalStatus(unittest.TestCase):
    def setUp(self) -> None:
        self._runtime_dir = TemporaryDirectory()
        self._old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
        os.environ["ORCH_RUNTIME_DIR"] = self._runtime_dir.name
        self._job_ids: List[str] = []

    def tearDown(self) -> None:
        with JOB_STORE._lock:
            for job_id in self._job_ids:
                JOB_STORE._jobs.pop(job_id, None)
        if self._old_runtime_dir is None:
            os.environ.pop("ORCH_RUNTIME_DIR", None)
        else:
            os.environ["ORCH_RUNTIME_DIR"] = self._old_runtime_dir
        self._runtime_dir.cleanup()

    def _create_job(self) -> str:
        job_id = f"job_{uuid4().hex}"
        JOB_STORE.create_job(_base_uir(job_id))
        self._job_ids.append(job_id)
        return job_id

    def test_update_job_does_not_override_terminal(self) -> None:
        job_id = self._create_job()
        JOB_STORE.update_job(job_id, status=JobStatus.DONE, message="done")
        JOB_STORE.update_job(job_id, status=JobStatus.RUNNING_MOTION, message="override")
        job = JOB_STORE.get_job(job_id)
        self.assertIsNotNone(job)
        self.assertEqual(job.status, JobStatus.DONE)
        self.assertEqual(job.message, "done")

    def test_cancel_job_sets_terminal_fields(self) -> None:
        job_id = self._create_job()
        job = JOB_STORE.cancel_job(job_id, message="user canceled")
        self.assertIsNotNone(job)
        self.assertEqual(job.status, JobStatus.CANCELED)
        self.assertEqual(job.stage, JobStatus.CANCELED.value)
        self.assertEqual(job.message, "user canceled")
        self.assertIsNotNone(job.ended_at)


if __name__ == "__main__":
    unittest.main()
