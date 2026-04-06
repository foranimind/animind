import asyncio
from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import textwrap
import unittest

from services.orchestrator.src.config.providers import get_provider_profile
from services.orchestrator.src.scheduler.events import EVENT_BUS
from services.orchestrator.src.scheduler.models import JobStatus
from services.orchestrator.src.scheduler.store import JobStore
from services.orchestrator.src.scheduler.worker import _run_job
from services.orchestrator.src.uir.builder import build_uir_from_prompt

ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = str(ROOT / "services" / "orchestrator" / "src")
_ORCH_ENV_KEYS = (
    "ORCH_EXECUTION_MODE",
    "ORCH_PROVIDER_SCENE",
    "ORCH_PROVIDER_MOTION",
    "ORCH_PROVIDER_MUSIC",
    "ORCH_PROVIDER_CHARACTER",
    "ORCH_PROVIDER_PREVIEW",
    "ORCH_PROVIDER_EXPORT",
)


@contextmanager
def orch_provider_env(**overrides):
    previous = {key: os.environ.get(key) for key in _ORCH_ENV_KEYS}
    try:
        for key in _ORCH_ENV_KEYS:
            os.environ.pop(key, None)
        for key, value in overrides.items():
            if value is not None:
                os.environ[key] = value
        yield
    finally:
        for key in _ORCH_ENV_KEYS:
            os.environ.pop(key, None)
        for key, value in previous.items():
            if value is not None:
                os.environ[key] = value


def _scene_only_uir(job_id: str = "job_invalid_mode") -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "test prompt", "lang": "en"},
        "intent": {"targets": ["scene"], "duration_s": 12},
        "modules": {
            "scene": {
                "enabled": True,
                "prompt": "panorama scene",
                "resolution": [2048, 1024],
            },
            "motion": {"enabled": False},
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


def _motion_only_uir(job_id: str = "job_retryable_motion") -> dict:
    return {
        "uir_version": "1.0",
        "job": {"id": job_id, "created_at": "2025-12-20T00:00:00Z"},
        "input": {"raw_prompt": "retry motion prompt", "lang": "en"},
        "intent": {"targets": ["motion"], "duration_s": 12},
        "routing": {
            "motion": {"provider": "test_retryable_motion"},
        },
        "modules": {
            "scene": {"enabled": False},
            "motion": {
                "enabled": True,
                "prompt": "warrior slash",
                "fps": 30,
                "duration_s": 12,
            },
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }


class TestProviderConfig(unittest.TestCase):
    def test_local_mode_keeps_existing_local_providers(self):
        with orch_provider_env(ORCH_EXECUTION_MODE="local"):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_local")
            self.assertEqual(profile.scene, "diffusion360_local")
            self.assertEqual(profile.music, "musicgpt_cli")

    def test_relay_mode_switches_motion_scene_music(self):
        with orch_provider_env(ORCH_EXECUTION_MODE="relay"):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_relay")
            self.assertEqual(profile.scene, "diffusion360_relay")
            self.assertEqual(profile.music, "musicgpt_relay")

    def test_blank_provider_override_falls_back_to_selected_profile(self):
        with orch_provider_env(
            ORCH_EXECUTION_MODE="relay",
            ORCH_PROVIDER_SCENE="   ",
            ORCH_PROVIDER_MOTION="",
        ):
            uir = build_uir_from_prompt(
                "sunset warrior", {"targets": ["motion", "scene"]}
            )
            self.assertEqual(uir["routing"]["motion"]["provider"], "animationgpt_relay")
            self.assertEqual(uir["routing"]["scene"]["provider"], "diffusion360_relay")

    def test_invalid_execution_mode_raises_value_error(self):
        with orch_provider_env(ORCH_EXECUTION_MODE="relai"):
            with self.assertRaises(ValueError):
                get_provider_profile()

    def test_build_uir_uses_current_profile(self):
        with orch_provider_env(ORCH_EXECUTION_MODE="relay"):
            uir = build_uir_from_prompt(
                "sunset warrior", {"targets": ["motion", "scene", "music"]}
            )
            self.assertEqual(uir["routing"]["motion"]["provider"], "animationgpt_relay")
            self.assertEqual(uir["routing"]["scene"]["provider"], "diffusion360_relay")
            self.assertEqual(uir["routing"]["music"]["provider"], "musicgpt_relay")

    def test_top_level_uir_import_still_works(self):
        script = textwrap.dedent(
            f"""
            import importlib
            import sys

            sys.path.insert(0, r"{SRC_ROOT}")
            module = importlib.import_module("uir")
            assert callable(module.build_uir_from_prompt)
            """
        )
        completed = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            check=False,
            env={key: value for key, value in os.environ.items() if key not in _ORCH_ENV_KEYS},
        )
        self.assertEqual(
            completed.returncode,
            0,
            msg=completed.stderr or completed.stdout,
        )

    def test_top_level_uir_import_prefers_repo_sibling_config_package(self):
        with TemporaryDirectory() as conflict_root:
            conflict_config = Path(conflict_root) / "config"
            conflict_config.mkdir(parents=True, exist_ok=True)
            (conflict_config / "__init__.py").write_text("", encoding="utf-8")
            (conflict_config / "providers.py").write_text(
                "raise RuntimeError('foreign config imported')\n",
                encoding="utf-8",
            )
            script = textwrap.dedent(
                f"""
                import importlib
                import sys

                sys.path[:] = [r"{conflict_root}", r"{SRC_ROOT}"] + sys.path
                module = importlib.import_module("uir")
                assert callable(module.build_uir_from_prompt)
                """
            )
            completed = subprocess.run(
                [sys.executable, "-c", script],
                capture_output=True,
                text=True,
                check=False,
                env={key: value for key, value in os.environ.items() if key not in _ORCH_ENV_KEYS},
            )
            self.assertEqual(
                completed.returncode,
                0,
                msg=completed.stderr or completed.stdout,
            )


class TestProviderConfigWorker(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_execution_mode_fails_as_non_retryable_config_error(self):
        with TemporaryDirectory() as temp_dir:
            previous_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
            os.environ["ORCH_RUNTIME_DIR"] = temp_dir
            try:
                with orch_provider_env(ORCH_EXECUTION_MODE="relai"):
                    store = JobStore()
                    job = store.create_job(_scene_only_uir())
                    queue = await EVENT_BUS.subscribe(job.job_id)
                    try:
                        await _run_job(store, job.job_id)
                        failed_event = None
                        while True:
                            event = await asyncio.wait_for(queue.get(), timeout=1.0)
                            if event["event"] == "failed":
                                failed_event = event
                                break
                        self.assertIsNotNone(failed_event)
                        data = failed_event["data"]
                        self.assertEqual(data["status"], JobStatus.FAILED.value)
                        self.assertEqual(data["payload"]["code"], "E_VALIDATION_CONFIG")
                        self.assertFalse(data["payload"]["retryable"])
                    finally:
                        await EVENT_BUS.unsubscribe(job.job_id, queue)
            finally:
                if previous_runtime_dir is None:
                    os.environ.pop("ORCH_RUNTIME_DIR", None)
                else:
                    os.environ["ORCH_RUNTIME_DIR"] = previous_runtime_dir

    async def test_retryable_motion_error_is_retried_before_job_fails(self):
        class FlakyRetryableMotionAdapter:
            provider_id = "test_retryable_motion"
            modality = "motion"
            max_concurrency = 1

            def __init__(self) -> None:
                self.calls = 0

            def validate(self, uir: dict) -> None:
                return None

            def run(self, uir: dict, out_dir: Path, reporter) -> dict:
                del uir, out_dir, reporter
                self.calls += 1
                if self.calls == 1:
                    return {
                        "ok": False,
                        "provider": self.provider_id,
                        "artifacts": [],
                        "meta": {},
                        "warnings": [],
                        "error": {
                            "code": "E_MODEL_RUNTIME",
                            "message": "cold start",
                            "detail": {"attempt": self.calls},
                            "retryable": True,
                        },
                    }
                return {
                    "ok": True,
                    "provider": self.provider_id,
                    "artifacts": [],
                    "meta": {"attempt": self.calls},
                    "warnings": [],
                    "error": None,
                }

        with TemporaryDirectory() as temp_dir:
            previous_runtime_dir = os.environ.get("ORCH_RUNTIME_DIR")
            os.environ["ORCH_RUNTIME_DIR"] = temp_dir
            try:
                store = JobStore()
                job = store.create_job(_motion_only_uir())
                queue = await EVENT_BUS.subscribe(job.job_id)
                adapter = FlakyRetryableMotionAdapter()
                try:
                    from unittest.mock import patch

                    with patch(
                        "services.orchestrator.src.scheduler.worker.get_adapter",
                        return_value=adapter,
                    ):
                        await _run_job(store, job.job_id)

                    events = []
                    while True:
                        try:
                            event = await asyncio.wait_for(queue.get(), timeout=0.05)
                        except TimeoutError:
                            break
                        events.append(event)

                    self.assertEqual(adapter.calls, 2)
                    self.assertNotIn("failed", [event["event"] for event in events])
                    completed = store.get_job(job.job_id)
                    self.assertIsNotNone(completed)
                    self.assertEqual(completed.status, JobStatus.DONE)
                finally:
                    await EVENT_BUS.unsubscribe(job.job_id, queue)
            finally:
                if previous_runtime_dir is None:
                    os.environ.pop("ORCH_RUNTIME_DIR", None)
                else:
                    os.environ["ORCH_RUNTIME_DIR"] = previous_runtime_dir
