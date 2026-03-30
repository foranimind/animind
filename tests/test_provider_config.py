from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest

from services.orchestrator.src.config.providers import get_provider_profile
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
