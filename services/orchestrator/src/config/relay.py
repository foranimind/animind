from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RelaySettings:
    base_url: str
    token: str
    timeout_s: float
    verify_tls: bool


def get_relay_settings() -> RelaySettings:
    return RelaySettings(
        base_url=os.getenv("RELAY_BASE_URL", "").strip().rstrip("/"),
        token=os.getenv("RELAY_SHARED_TOKEN", "").strip(),
        timeout_s=_float_env("RELAY_TIMEOUT_S", 30.0),
        verify_tls=os.getenv("RELAY_VERIFY_TLS", "1").strip() != "0",
    )


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw.strip())
    except ValueError:
        return default
    return value if value > 0 else default
