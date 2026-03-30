from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RelaySettings:
    token: str
    runtime_dir: str
    orchestrator_base_url: str
    orchestrator_token: str


def get_settings() -> RelaySettings:
    return RelaySettings(
        token=os.getenv("RELAY_SHARED_TOKEN", "").strip(),
        runtime_dir=os.getenv("RELAY_RUNTIME_DIR", "relay_runtime").strip(),
        orchestrator_base_url=os.getenv("ORCHESTRATOR_BASE_URL", "").strip().rstrip("/"),
        orchestrator_token=os.getenv("ORCHESTRATOR_RELAY_TOKEN", "").strip(),
    )
