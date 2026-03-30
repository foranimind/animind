import os
import sys
import unittest
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from services.relay.src.main import create_app


class TestRelayTaskApi(unittest.TestCase):
    def test_post_task_returns_queued_record(self):
        with TemporaryDirectory() as temp_dir:
            old_runtime_dir = os.environ.get("RELAY_RUNTIME_DIR")
            old_token = os.environ.get("RELAY_SHARED_TOKEN")
            os.environ["RELAY_RUNTIME_DIR"] = temp_dir
            os.environ["RELAY_SHARED_TOKEN"] = "relay-token"
            try:
                app = create_app()
                client = TestClient(app)
                response = client.post(
                    "/v1/tasks",
                    json={
                        "job_id": "job_123",
                        "kind": "music",
                        "input": {"prompt": "ambient"},
                        "options": {"duration_s": 8},
                    },
                    headers={"X-Relay-Token": "relay-token"},
                )
                self.assertEqual(response.status_code, 202)
                payload = response.json()
                self.assertEqual(payload["job_id"], "job_123")
                self.assertEqual(payload["kind"], "music")
                self.assertEqual(payload["status"], "queued")
                self.assertIn("task_id", payload)
            finally:
                if old_runtime_dir is None:
                    os.environ.pop("RELAY_RUNTIME_DIR", None)
                else:
                    os.environ["RELAY_RUNTIME_DIR"] = old_runtime_dir
                if old_token is None:
                    os.environ.pop("RELAY_SHARED_TOKEN", None)
                else:
                    os.environ["RELAY_SHARED_TOKEN"] = old_token


if __name__ == "__main__":
    unittest.main()
