import os
import unittest
from unittest.mock import patch

from services.orchestrator.src.config.providers import get_provider_profile
from services.orchestrator.src.uir.builder import build_uir_from_prompt


class TestProviderConfig(unittest.TestCase):
    def test_local_mode_keeps_existing_local_providers(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "local"}, clear=False):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_local")
            self.assertEqual(profile.scene, "diffusion360_local")
            self.assertEqual(profile.music, "musicgpt_cli")

    def test_relay_mode_switches_motion_scene_music(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "relay"}, clear=False):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_relay")
            self.assertEqual(profile.scene, "diffusion360_relay")
            self.assertEqual(profile.music, "musicgpt_relay")

    def test_build_uir_uses_current_profile(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "relay"}, clear=False):
            uir = build_uir_from_prompt(
                "sunset warrior", {"targets": ["motion", "scene", "music"]}
            )
            self.assertEqual(uir["routing"]["motion"]["provider"], "animationgpt_relay")
            self.assertEqual(uir["routing"]["scene"]["provider"], "diffusion360_relay")
            self.assertEqual(uir["routing"]["music"]["provider"], "musicgpt_relay")
