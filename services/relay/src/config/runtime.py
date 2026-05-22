from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .settings import get_settings

_REPO_ROOT = Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class RuntimePaths:
    runtime_dir: Path
    tasks_dir: Path
    cache_dir: Path
    logs_dir: Path


def get_runtime_paths() -> RuntimePaths:
    settings = get_settings()
    runtime_dir = Path(settings.runtime_dir).expanduser()
    if not runtime_dir.is_absolute():
        runtime_dir = _REPO_ROOT / runtime_dir
    try:
        runtime_dir = runtime_dir.resolve()
    except OSError:
        runtime_dir = runtime_dir.absolute()
    tasks_dir = runtime_dir / "tasks"
    cache_dir = runtime_dir / "cache"
    logs_dir = runtime_dir / "logs"
    for path in (runtime_dir, tasks_dir, cache_dir, logs_dir):
        path.mkdir(parents=True, exist_ok=True)
    return RuntimePaths(
        runtime_dir=runtime_dir,
        tasks_dir=tasks_dir,
        cache_dir=cache_dir,
        logs_dir=logs_dir,
    )
