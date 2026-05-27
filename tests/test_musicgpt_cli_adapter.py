import json
import subprocess
import wave
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np

from services.orchestrator.src.adapters.musicgpt_cli import MusicGPTCliAdapter


class _Reporter:
    cancel_token = None

    def __init__(self) -> None:
        self.events = []

    def stage(self, name, progress, message="", extra=None):
        self.events.append((name, progress, message, extra))

    def log(self, line):
        self.events.append(("log", line))

    def is_canceled(self) -> bool:
        return False


def _write_wav(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(b"\x00\x00" * 160)


def _base_uir() -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": "job_music", "created_at": "2026-04-15T00:00:00Z"},
        "input": {"raw_prompt": "warrior strike with battle music", "lang": "en"},
        "intent": {"targets": ["motion", "music"], "duration_s": 8},
        "modules": {
            "motion": {
                "enabled": True,
                "prompt": "A warrior lunges forward with a heavy strike.",
                "fps": 30,
                "duration_s": 8,
            },
            "music": {
                "enabled": True,
                "prompt": "epic orchestral battle music with taiko drums",
                "duration_s": 8,
            },
            "scene": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestMusicGPTCliAdapter(unittest.TestCase):
    def test_run_uses_motion_rhythm_prompt_when_motion_npy_exists(self) -> None:
        with TemporaryDirectory() as temp_dir:
            job_dir = Path(temp_dir) / "job_music"
            motion_dir = job_dir / "motion"
            motion_dir.mkdir(parents=True, exist_ok=True)

            frames = np.array(
                [
                    [[0.0, 0.0, 0.0]],
                    [[0.0, 0.0, 0.0]],
                    [[3.0, 0.0, 0.0]],
                    [[0.0, 0.0, 0.0]],
                    [[0.0, 0.0, 0.0]],
                ],
                dtype=np.float32,
            )
            np.save(motion_dir / "motion_out.npy", frames)

            adapter = MusicGPTCliAdapter()
            reporter = _Reporter()
            captured = {}

            def fake_run_subprocess(cmd, **kwargs):
                captured["prompt"] = cmd[1]
                _write_wav(Path(cmd[-1]))
                return subprocess.CompletedProcess(cmd, 0)

            with patch(
                "services.orchestrator.src.adapters.musicgpt_cli._resolve_musicgpt_bin",
                return_value=Path("C:/fake/musicgpt.exe"),
            ):
                with patch(
                    "services.orchestrator.src.adapters.musicgpt_cli.run_subprocess",
                    side_effect=fake_run_subprocess,
                ):
                    result = adapter.run(_base_uir(), job_dir, reporter)

            self.assertTrue(result["ok"])
            self.assertIn("Rhythm alignment instructions", captured["prompt"])
            self.assertIn("Music style requirement", captured["prompt"])
            self.assertIn(
                "epic orchestral battle music with taiko drums",
                captured["prompt"],
            )

            meta = json.loads((job_dir / "music" / "music_meta.json").read_text(encoding="utf-8"))
            self.assertEqual(
                meta["prompt_original"], "epic orchestral battle music with taiko drums"
            )
            self.assertIn("Rhythm alignment instructions", meta["prompt_used"])

    def test_run_falls_back_to_original_prompt_when_motion_npy_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            job_dir = Path(temp_dir) / "job_music"
            job_dir.mkdir(parents=True, exist_ok=True)

            adapter = MusicGPTCliAdapter()
            reporter = _Reporter()
            captured = {}

            def fake_run_subprocess(cmd, **kwargs):
                captured["prompt"] = cmd[1]
                _write_wav(Path(cmd[-1]))
                return subprocess.CompletedProcess(cmd, 0)

            with patch(
                "services.orchestrator.src.adapters.musicgpt_cli._resolve_musicgpt_bin",
                return_value=Path("C:/fake/musicgpt.exe"),
            ):
                with patch(
                    "services.orchestrator.src.adapters.musicgpt_cli.run_subprocess",
                    side_effect=fake_run_subprocess,
                ):
                    result = adapter.run(_base_uir(), job_dir, reporter)

            self.assertTrue(result["ok"])
            self.assertEqual(
                captured["prompt"], "epic orchestral battle music with taiko drums"
            )
            meta = json.loads((job_dir / "music" / "music_meta.json").read_text(encoding="utf-8"))
            self.assertEqual(
                meta["prompt_used"], "epic orchestral battle music with taiko drums"
            )


if __name__ == "__main__":
    unittest.main()
