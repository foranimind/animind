import io
import json
import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.orchestrator.src.main import create_app
from services.orchestrator.src.scheduler.store import JOB_STORE


def _base_uir(job_id: str) -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "relay upload test", "lang": "en"},
        "intent": {"targets": ["music"], "duration_s": 8},
        "modules": {
            "scene": {"enabled": False},
            "motion": {"enabled": False},
            "music": {"enabled": True, "prompt": "ambient", "duration_s": 8},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestRelayUploadApi(unittest.TestCase):
    def setUp(self) -> None:
        self._runtime_dir = TemporaryDirectory()
        self._old_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
        self._old_relay_token = os.environ.get("RELAY_SHARED_TOKEN")
        os.environ["ORCH_RUNTIME_DIR"] = self._runtime_dir.name
        os.environ["RELAY_SHARED_TOKEN"] = "test-token"

    def tearDown(self) -> None:
        if self._old_runtime_dir is None:
            os.environ.pop("ORCH_RUNTIME_DIR", None)
        else:
            os.environ["ORCH_RUNTIME_DIR"] = self._old_runtime_dir
        if self._old_relay_token is None:
            os.environ.pop("RELAY_SHARED_TOKEN", None)
        else:
            os.environ["RELAY_SHARED_TOKEN"] = self._old_relay_token
        self._runtime_dir.cleanup()

    def _create_job(self) -> str:
        job_id = f"job_{uuid4().hex}"
        JOB_STORE.create_job(_base_uir(job_id))
        return job_id

    def test_relay_upload_writes_cloud_asset(self) -> None:
        app = create_app()
        client = TestClient(app)
        job_id = self._create_job()

        response = client.post(
            f"/api/jobs/{job_id}/relay-upload",
            data={
                "manifest": json.dumps(
                    [
                        {
                            "role": "music_wav",
                            "relative_path": "music/music.wav",
                            "mime": "audio/wav",
                        }
                    ]
                )
            },
            files={"files": ("music.wav", io.BytesIO(b"wav"), "audio/wav")},
            headers={"X-Relay-Token": "test-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["artifacts"][0]["uri"],
            f"/assets/{job_id}/music/music.wav",
        )
        self.assertTrue(
            Path(self._runtime_dir.name, "assets", job_id, "music", "music.wav").is_file()
        )

    def test_relay_upload_rejects_path_traversal(self) -> None:
        app = create_app()
        client = TestClient(app)
        job_id = self._create_job()

        response = client.post(
            f"/api/jobs/{job_id}/relay-upload",
            data={
                "manifest": json.dumps(
                    [
                        {
                            "role": "music_wav",
                            "relative_path": "../escape.wav",
                            "mime": "audio/wav",
                        }
                    ]
                )
            },
            files={"files": ("escape.wav", io.BytesIO(b"wav"), "audio/wav")},
            headers={"X-Relay-Token": "test-token"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(Path(self._runtime_dir.name, "assets", "escape.wav").exists())

    def test_relay_upload_rejects_manifest_file_mismatch(self) -> None:
        app = create_app()
        client = TestClient(app)
        job_id = self._create_job()

        response = client.post(
            f"/api/jobs/{job_id}/relay-upload",
            data={
                "manifest": json.dumps(
                    [
                        {
                            "role": "music_wav",
                            "relative_path": "music/expected.wav",
                            "mime": "audio/wav",
                        }
                    ]
                )
            },
            files={"files": ("different.wav", io.BytesIO(b"wav"), "audio/wav")},
            headers={"X-Relay-Token": "test-token"},
        )

        self.assertEqual(response.status_code, 422)

    def test_relay_upload_rejects_ambiguous_duplicate_filenames(self) -> None:
        app = create_app()
        client = TestClient(app)
        job_id = self._create_job()

        response = client.post(
            f"/api/jobs/{job_id}/relay-upload",
            data={
                "manifest": json.dumps(
                    [
                        {
                            "role": "music_wav",
                            "relative_path": "one/output.wav",
                            "mime": "audio/wav",
                        },
                        {
                            "role": "music_wav",
                            "relative_path": "two/output.wav",
                            "mime": "audio/wav",
                        },
                    ]
                )
            },
            files=[
                ("files", ("output.wav", io.BytesIO(b"first"), "audio/wav")),
                ("files", ("output.wav", io.BytesIO(b"second"), "audio/wav")),
            ],
            headers={"X-Relay-Token": "test-token"},
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
