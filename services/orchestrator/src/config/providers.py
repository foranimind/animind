from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderProfile:
    scene: str
    motion: str
    music: str
    character: str
    preview: str
    export: str


_LOCAL = ProviderProfile(
    "diffusion360_local",
    "animationgpt_local",
    "musicgpt_cli",
    "builtin_library",
    "web_threejs",
    "ffmpeg_export",
)
_RELAY = ProviderProfile(
    "diffusion360_relay",
    "animationgpt_relay",
    "musicgpt_relay",
    "builtin_library",
    "web_threejs",
    "ffmpeg_export",
)


def get_provider_profile() -> ProviderProfile:
    mode = os.getenv("ORCH_EXECUTION_MODE", "local").strip().lower()
    base = _RELAY if mode == "relay" else _LOCAL
    return ProviderProfile(
        scene=os.getenv("ORCH_PROVIDER_SCENE", base.scene).strip(),
        motion=os.getenv("ORCH_PROVIDER_MOTION", base.motion).strip(),
        music=os.getenv("ORCH_PROVIDER_MUSIC", base.music).strip(),
        character=os.getenv("ORCH_PROVIDER_CHARACTER", base.character).strip(),
        preview=os.getenv("ORCH_PROVIDER_PREVIEW", base.preview).strip(),
        export=os.getenv("ORCH_PROVIDER_EXPORT", base.export).strip(),
    )


def get_default_provider(modality: str) -> str | None:
    profile = get_provider_profile()
    return getattr(profile, modality, None)
