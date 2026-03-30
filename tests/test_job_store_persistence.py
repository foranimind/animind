import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.orchestrator.src.scheduler.models import JobStatus
from services.orchestrator.src.scheduler.store import JOB_STORE, JobStore


def _base_uir(job_id: str) -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "persistent job", "lang": "en"},
        "intent": {"targets": ["scene"], "duration_s": 12},
        "modules": {
            "scene": {"enabled": True, "prompt": "panorama scene"},
            "motion": {"enabled": False},
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestJobStorePersistence(unittest.TestCase):
    def test_jobs_restore_after_store_recreation(self) -> None:
        with TemporaryDirectory() as temp_dir:
            old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
            os.environ["ORCH_RUNTIME_DIR"] = temp_dir
            try:
                store_a = JobStore()
                job_id = f"job_{uuid4().hex}"
                job = store_a.create_job(_base_uir(job_id))
                store_a.update_job(job.job_id, status="FAILED", message="relay disconnected")

                store_b = JobStore()
                restored = store_b.get_job(job.job_id)

                self.assertIsNotNone(restored)
                self.assertEqual(restored.status, JobStatus.FAILED)
                self.assertEqual(restored.message, "relay disconnected")
                self.assertEqual(restored.manifest_url, f"/assets/{job.job_id}/manifest.json")
            finally:
                if old_runtime_dir is None:
                    os.environ.pop("ORCH_RUNTIME_DIR", None)
                else:
                    os.environ["ORCH_RUNTIME_DIR"] = old_runtime_dir

    def test_global_job_store_uses_current_runtime_dir(self) -> None:
        old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
        with TemporaryDirectory() as first_dir, TemporaryDirectory() as second_dir:
            try:
                first_job_id = f"job_{uuid4().hex}"
                os.environ["ORCH_RUNTIME_DIR"] = first_dir
                JOB_STORE.create_job(_base_uir(first_job_id))

                second_job_id = f"job_{uuid4().hex}"
                os.environ["ORCH_RUNTIME_DIR"] = second_dir
                JOB_STORE.create_job(_base_uir(second_job_id))

                self.assertTrue(Path(first_dir, "assets", first_job_id, "manifest.json").is_file())
                self.assertTrue(Path(second_dir, "assets", second_job_id, "manifest.json").is_file())
                self.assertTrue(Path(first_dir, "jobs.db").is_file())
                self.assertTrue(Path(second_dir, "jobs.db").is_file())
            finally:
                if old_runtime_dir is None:
                    os.environ.pop("ORCH_RUNTIME_DIR", None)
                else:
                    os.environ["ORCH_RUNTIME_DIR"] = old_runtime_dir


if __name__ == "__main__":
    unittest.main()
