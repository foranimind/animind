from __future__ import annotations

import os
from collections.abc import Mapping
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
_PROFILES: Mapping[str, ProviderProfile] = {
    "local": _LOCAL,
    "relay": _RELAY,
}


def get_provider_profile() -> ProviderProfile:
    raw_mode = os.getenv("ORCH_EXECUTION_MODE", "local")
    mode = raw_mode.strip().lower() or "local"
    try:
        base = _PROFILES[mode]
    except KeyError as exc:
        raise ValueError(f"invalid ORCH_EXECUTION_MODE: {raw_mode!r}") from exc
    return ProviderProfile(
        scene=_provider_override("ORCH_PROVIDER_SCENE", base.scene),
        motion=_provider_override("ORCH_PROVIDER_MOTION", base.motion),
        music=_provider_override("ORCH_PROVIDER_MUSIC", base.music),
        character=_provider_override("ORCH_PROVIDER_CHARACTER", base.character),
        preview=_provider_override("ORCH_PROVIDER_PREVIEW", base.preview),
        export=_provider_override("ORCH_PROVIDER_EXPORT", base.export),
    )


def get_default_provider(modality: str) -> str | None:
    profile = get_provider_profile()
    return getattr(profile, modality, None)


def _provider_override(env_name: str, default: str) -> str:
    value = os.getenv(env_name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped or default
