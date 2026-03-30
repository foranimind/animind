import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.orchestrator.src.adapters.base import AdapterCanceled, CancelToken
from services.orchestrator.src.adapters.registry import get_adapter, list_adapters
from services.orchestrator.src.adapters.remote_motion import RemoteMotionAdapter
from services.orchestrator.src.adapters.remote_music import RemoteMusicAdapter
from services.orchestrator.src.adapters.remote_scene import RemoteSceneAdapter
from services.orchestrator.src.adapters.relay_client import RelayClient


def _base_uir(job_id: str) -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "relay adapter test", "lang": "en"},
        "intent": {"targets": ["motion", "scene", "music"], "duration_s": 8},
        "modules": {
            "motion": {"enabled": True, "prompt": "walk cycle", "fps": 30, "duration_s": 8},
            "scene": {"enabled": True, "prompt": "sunset skyline", "resolution": [2048, 1024]},
            "music": {"enabled": True, "prompt": "ambient synth", "duration_s": 8},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class Reporter:
    def __init__(self, cancel_after_stage: int | None = None) -> None:
        self.cancel_token = CancelToken()
        self.events = []
        self._cancel_after_stage = cancel_after_stage
        self._stage_calls = 0

    def stage(self, name, progress, message="", extra=None):
        self.events.append(("stage", name, progress, message, extra))
        self._stage_calls += 1
        if (
            self._cancel_after_stage is not None
            and self._stage_calls >= self._cancel_after_stage
        ):
            self.cancel_token.cancel()

    def log(self, line):
        self.events.append(("log", line))

    def is_canceled(self):
        return self.cancel_token.is_canceled()


class TestRelayClient(unittest.TestCase):
    @patch("services.orchestrator.src.adapters.relay_client.httpx.Client")
    def test_create_task_and_get_task_use_relay_settings(self, client_cls) -> None:
        client = client_cls.return_value.__enter__.return_value
        post_response = Mock()
        post_response.json.return_value = {"task_id": "task_1", "status": "queued"}
        get_response = Mock()
        get_response.json.return_value = {"task_id": "task_1", "status": "running"}
        client.post.return_value = post_response
        client.get.return_value = get_response

        old_env = {
            "RELAY_BASE_URL": os.environ.get("RELAY_BASE_URL"),
            "RELAY_SHARED_TOKEN": os.environ.get("RELAY_SHARED_TOKEN"),
            "RELAY_TIMEOUT_S": os.environ.get("RELAY_TIMEOUT_S"),
            "RELAY_VERIFY_TLS": os.environ.get("RELAY_VERIFY_TLS"),
        }
        os.environ["RELAY_BASE_URL"] = "https://relay.example.test"
        os.environ["RELAY_SHARED_TOKEN"] = "relay-token"
        os.environ["RELAY_TIMEOUT_S"] = "12"
        os.environ["RELAY_VERIFY_TLS"] = "0"
        try:
            relay = RelayClient()
            created = relay.create_task({"job_id": "job_1", "kind": "motion"})
            task = relay.get_task("task_1")
        finally:
            for key, value in old_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

        self.assertEqual(created["task_id"], "task_1")
        self.assertEqual(task["status"], "running")
        client_cls.assert_called_with(timeout=12.0, verify=False)
        client.post.assert_called_once_with(
            "https://relay.example.test/v1/tasks",
            json={"job_id": "job_1", "kind": "motion"},
            headers={"X-Relay-Token": "relay-token"},
        )
        client.get.assert_called_once_with(
            "https://relay.example.test/v1/tasks/task_1",
            headers={"X-Relay-Token": "relay-token"},
        )
        post_response.raise_for_status.assert_called_once_with()
        get_response.raise_for_status.assert_called_once_with()


class TestRemoteAdapters(unittest.TestCase):
    @patch("services.orchestrator.src.adapters.remote_motion.time.sleep", return_value=None)
    @patch("services.orchestrator.src.adapters.remote_motion.RelayClient")
    def test_remote_motion_adapter_returns_cloud_asset_refs(
        self, client_cls, _sleep
    ) -> None:
        client = client_cls.return_value
        client.create_task.return_value = {"task_id": "task_motion", "status": "queued"}
        client.get_task.side_effect = [
            {"task_id": "task_motion", "status": "running", "progress": 0.4},
            {
                "task_id": "task_motion",
                "status": "succeeded",
                "progress": 1.0,
                "artifacts": [
                    {
                        "role": "motion_bvh",
                        "relative_path": "motion/motion.bvh",
                        "mime": "text/plain",
                        "bytes": 128,
                    }
                ],
            },
        ]

        adapter = RemoteMotionAdapter()
        reporter = Reporter()
        with TemporaryDirectory() as temp_dir:
            result = adapter.run(_base_uir("job_motion"), Path(temp_dir), reporter)

        self.assertTrue(result["ok"])
        self.assertEqual(result["provider"], "animationgpt_relay")
        self.assertEqual(result["meta"]["task_id"], "task_motion")
        self.assertEqual(result["artifacts"][0]["uri"], "/assets/job_motion/motion/motion.bvh")
        self.assertEqual(result["artifacts"][0]["bytes"], 128)
        self.assertGreaterEqual(len(reporter.events), 2)
        client.create_task.assert_called_once()
        self.assertEqual(client.get_task.call_count, 2)

    @patch("services.orchestrator.src.adapters.remote_music.time.sleep", return_value=None)
    @patch("services.orchestrator.src.adapters.remote_music.RelayClient")
    def test_remote_music_adapter_surfaces_relay_failure(
        self, client_cls, _sleep
    ) -> None:
        client = client_cls.return_value
        client.create_task.return_value = {"task_id": "task_music", "status": "queued"}
        client.get_task.side_effect = [
            {"task_id": "task_music", "status": "running", "progress": 0.2},
            {
                "task_id": "task_music",
                "status": "failed",
                "progress": 0.2,
                "error": {"code": "EXEC_FAILED", "message": "music model crashed"},
            },
        ]

        adapter = RemoteMusicAdapter()
        reporter = Reporter()
        with TemporaryDirectory() as temp_dir:
            result = adapter.run(_base_uir("job_music"), Path(temp_dir), reporter)

        self.assertFalse(result["ok"])
        self.assertEqual(result["provider"], "musicgpt_relay")
        self.assertEqual(result["error"]["code"], "EXEC_FAILED")
        self.assertIn("music model crashed", result["error"]["message"])
        self.assertEqual(result["error"]["detail"]["task_id"], "task_music")
        self.assertTrue(result["error"]["retryable"])

    @patch("services.orchestrator.src.adapters.remote_scene.time.sleep", return_value=None)
    @patch("services.orchestrator.src.adapters.remote_scene.RelayClient")
    def test_remote_scene_adapter_stops_polling_when_canceled(
        self, client_cls, _sleep
    ) -> None:
        client = client_cls.return_value
        client.create_task.return_value = {"task_id": "task_scene", "status": "queued"}
        client.get_task.return_value = {
            "task_id": "task_scene",
            "status": "running",
            "progress": 0.3,
        }

        adapter = RemoteSceneAdapter()
        reporter = Reporter(cancel_after_stage=1)

        with TemporaryDirectory() as temp_dir:
            with self.assertRaises(AdapterCanceled):
                adapter.run(_base_uir("job_scene"), Path(temp_dir), reporter)

        client.create_task.assert_called_once()
        self.assertEqual(client.get_task.call_count, 1)

    def test_registry_keeps_local_providers_and_registers_remote_providers(self) -> None:
        providers = set(list_adapters())

        self.assertIn("animationgpt_local", providers)
        self.assertIn("diffusion360_local", providers)
        self.assertIn("musicgpt_cli", providers)
        self.assertIn("animationgpt_relay", providers)
        self.assertIn("diffusion360_relay", providers)
        self.assertIn("musicgpt_relay", providers)

        self.assertIsInstance(get_adapter("animationgpt_relay"), RemoteMotionAdapter)
        self.assertIsInstance(get_adapter("diffusion360_relay"), RemoteSceneAdapter)
        self.assertIsInstance(get_adapter("musicgpt_relay"), RemoteMusicAdapter)


if __name__ == "__main__":
    unittest.main()
