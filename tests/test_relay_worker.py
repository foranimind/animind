import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from services.relay.src.queue.worker import run_single_task


class TestRelayWorker(unittest.TestCase):
    @patch("services.relay.src.upload.orchestrator.upload_artifacts")
    @patch("services.relay.src.executors.dispatch.run_executor")
    def test_worker_marks_task_succeeded_after_upload(
        self, run_executor, upload_artifacts
    ):
        run_executor.return_value = [
            {
                "role": "music_wav",
                "relative_path": "music/music.wav",
                "mime": "audio/wav",
            }
        ]
        upload_artifacts.return_value = {
            "artifacts": [
                {
                    "role": "music_wav",
                    "relative_path": "music/music.wav",
                }
            ]
        }

        with TemporaryDirectory() as temp_dir:
            task = {
                "task_id": "task_1",
                "job_id": "job_123",
                "kind": "music",
                "status": "queued",
                "input": {"prompt": "ambient"},
                "options": {"duration_s": 8},
            }
            result = run_single_task(task, Path(temp_dir))
            self.assertEqual(result["status"], "succeeded")
            self.assertEqual(result["artifacts"][0]["role"], "music_wav")


if __name__ == "__main__":
    unittest.main()
