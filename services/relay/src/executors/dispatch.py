from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from services.orchestrator.src.adapters.animationgpt import AnimationGPTAdapter
from services.orchestrator.src.adapters.diffusion360 import Diffusion360Adapter
from services.orchestrator.src.adapters.musicgpt_cli import MusicGPTCliAdapter


class _RelayReporter:
    cancel_token = None

    def stage(self, name: str, progress: float, message: str = "", extra=None) -> None:
        return None

    def log(self, line: str) -> None:
        return None

    def is_canceled(self) -> bool:
        return False


def run_executor(task: Dict[str, Any], task_root: Path) -> List[Dict[str, Any]]:
    kind = str(task.get("kind") or "").strip().lower()
    job_id = str(task.get("job_id") or "").strip()
    if not job_id:
        raise ValueError("job_id is required")
    if kind == "motion":
        adapter = AnimationGPTAdapter()
    elif kind == "scene":
        adapter = Diffusion360Adapter()
    elif kind == "music":
        adapter = MusicGPTCliAdapter()
    else:
        raise ValueError(f"unsupported relay kind: {kind}")

    job_root = Path(task_root) / job_id
    job_root.mkdir(parents=True, exist_ok=True)
    result = adapter.run(_build_uir(task), job_root, _RelayReporter())
    if not result.get("ok"):
        error = result.get("error") if isinstance(result, dict) else None
        if isinstance(error, dict) and error.get("message"):
            raise RuntimeError(str(error["message"]))
        raise RuntimeError(f"{kind} relay execution failed")
    artifacts: List[Dict[str, Any]] = []
    for artifact in result.get("artifacts", []):
        if not isinstance(artifact, dict):
            continue
        role = artifact.get("role")
        uri = artifact.get("uri")
        if not isinstance(role, str) or not role.strip():
            continue
        relative_path = _relative_path_from_uri(job_id, uri)
        if not relative_path:
            continue
        relay_artifact: Dict[str, Any] = {
            "role": role.strip(),
            "relative_path": relative_path,
        }
        if artifact.get("mime") is not None:
            relay_artifact["mime"] = artifact.get("mime")
        if artifact.get("bytes") is not None:
            relay_artifact["bytes"] = artifact.get("bytes")
        artifacts.append(relay_artifact)
    return artifacts


def _build_uir(task: Dict[str, Any]) -> Dict[str, Any]:
    kind = str(task.get("kind") or "").strip().lower()
    job_id = str(task.get("job_id") or "").strip()
    input_payload = task.get("input") if isinstance(task.get("input"), dict) else {}
    options = task.get("options") if isinstance(task.get("options"), dict) else {}
    prompt = str(input_payload.get("prompt") or "")
    duration = options.get("duration_s")
    uir = {
        "uir_version": "1.0",
        "job": {"id": job_id},
        "input": {"raw_prompt": prompt},
        "intent": {"targets": [kind]},
        "modules": {
            "scene": {"enabled": False},
            "motion": {"enabled": False},
            "music": {"enabled": False},
            "character": {"enabled": False},
            "preview": {"enabled": False},
            "export": {"enabled": False},
        },
    }
    if kind == "motion":
        module = {"enabled": True, "prompt": prompt, "fps": options.get("fps", 30)}
        if duration is not None:
            module["duration_s"] = duration
        uir["modules"]["motion"] = module
    elif kind == "scene":
        module = {
            "enabled": True,
            "prompt": prompt,
            "resolution": options.get("resolution", [2048, 1024]),
        }
        if options.get("seed") is not None:
            module["seed"] = options.get("seed")
        uir["modules"]["scene"] = module
    elif kind == "music":
        module = {"enabled": True, "prompt": prompt}
        if duration is not None:
            module["duration_s"] = duration
        uir["modules"]["music"] = module
    return uir


def _relative_path_from_uri(job_id: str, uri: Any) -> str:
    if not isinstance(uri, str) or not uri:
        return ""
    prefix = f"/assets/{job_id}/"
    if uri.startswith(prefix):
        return uri[len(prefix) :]
    return ""
