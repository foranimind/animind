from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .base import (
    AdapterResult,
    BaseAdapter,
    ProgressReporter,
    build_asset_ref,
    build_error,
    run_subprocess,
)
from ..config.runtime import get_runtime_paths
from ..uir.validate import validate_uir
from ..utils.wsl import build_wsl_command, should_use_wsl, to_wsl_path, wsl_distro

_REPO_ROOT = Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class _AnimationGPTRuntime:
    animationgpt_root: Path
    motiongpt_root: Path
    demo_script: Path
    config_path: Path
    assets_config_path: Path
    checkpoint_path: Path
    npy_to_bvh_dir: Path
    joints2bvh_path: Path


def _animationgpt_root() -> Path:
    return Path(
        os.getenv(
            "ANIMATIONGPT_ROOT", str(_REPO_ROOT / "third_party" / "AnimationGPT")
        )
    )


def _motiongpt_root(animationgpt_root: Path) -> Path:
    return Path(
        os.getenv(
            "MOTIONGPT_ROOT", str(animationgpt_root / "algorithm" / "MotionGPT")
        )
    )


def _resolve_runtime_paths() -> _AnimationGPTRuntime:
    animationgpt_root = _animationgpt_root()
    motiongpt_root = _motiongpt_root(animationgpt_root)
    demo_script = motiongpt_root / "demo.py"
    npy_to_bvh_dir = animationgpt_root / "tools" / "npy2bvh"
    joints2bvh_path = npy_to_bvh_dir / "joints2bvh.py"

    config_path = _first_existing_path(
        [
            _path_from_env("ANIMATIONGPT_CFG"),
            motiongpt_root / "config_AGPT.yaml",
            animationgpt_root / "config_AGPT.yaml",
        ]
    )
    if config_path is None:
        config_path = motiongpt_root / "config_AGPT.yaml"

    checkpoint_path = _first_existing_path(
        _checkpoint_candidates(animationgpt_root, motiongpt_root, config_path)
    )
    if checkpoint_path is None:
        checkpoint_path = motiongpt_root / "mGPT.ckpt"

    return _AnimationGPTRuntime(
        animationgpt_root=animationgpt_root,
        motiongpt_root=motiongpt_root,
        demo_script=demo_script,
        config_path=config_path,
        assets_config_path=motiongpt_root / "configs" / "assets.yaml",
        checkpoint_path=checkpoint_path,
        npy_to_bvh_dir=npy_to_bvh_dir,
        joints2bvh_path=joints2bvh_path,
    )


def _path_from_env(env_name: str) -> Optional[Path]:
    value = os.getenv(env_name)
    if value and value.strip():
        return Path(value.strip())
    return None


def _first_existing_path(paths: List[Optional[Path]]) -> Optional[Path]:
    for path in paths:
        if path is not None and path.exists():
            return path
    return None


def _checkpoint_candidates(
    animationgpt_root: Path, motiongpt_root: Path, config_path: Path
) -> List[Optional[Path]]:
    candidates: List[Optional[Path]] = [_path_from_env("ANIMATIONGPT_CKPT")]
    configured = _configured_checkpoint_paths(config_path, motiongpt_root)
    candidates.extend(configured)
    candidates.extend(
        [
            motiongpt_root / "mGPT.ckpt",
            animationgpt_root / "mGPT.ckpt",
        ]
    )
    return candidates


def _configured_checkpoint_paths(
    config_path: Path, motiongpt_root: Path
) -> List[Optional[Path]]:
    raw = _configured_checkpoint_value(config_path)
    if not raw:
        return []
    configured_path = Path(raw)
    if configured_path.is_absolute():
        return [configured_path]
    return [motiongpt_root / configured_path, config_path.parent / configured_path]


def _configured_checkpoint_value(config_path: Path) -> Optional[str]:
    try:
        content = config_path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"^\s*CHECKPOINTS:\s*['\"]?([^'\"\r\n]+)['\"]?\s*$", content, re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip()
    return value or None


def _yaml_single_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _prepare_demo_cfg(
    runtime: _AnimationGPTRuntime, output_dir: Path, *, use_wsl: bool
) -> Path:
    default_cfg_path = runtime.motiongpt_root / "config_AGPT.yaml"
    default_ckpt_path = runtime.motiongpt_root / "mGPT.ckpt"
    if runtime.config_path == default_cfg_path and runtime.checkpoint_path == default_ckpt_path:
        return runtime.config_path

    try:
        content = runtime.config_path.read_text(encoding="utf-8")
    except OSError:
        return runtime.config_path

    output_dir.mkdir(parents=True, exist_ok=True)
    runtime_cfg_path = output_dir / "config_AGPT.runtime.yaml"
    checkpoint_path = (
        to_wsl_path(runtime.checkpoint_path) if use_wsl else str(runtime.checkpoint_path)
    )
    checkpoint_literal = _yaml_single_quote(checkpoint_path)
    pattern = re.compile(r"(^\s*CHECKPOINTS:\s*).*$", re.MULTILINE)
    if pattern.search(content):
        content = pattern.sub(
            lambda match: f"{match.group(1)}{checkpoint_literal}",
            content,
            count=1,
        )
    else:
        content = content.rstrip() + f"\nTEST:\n  CHECKPOINTS: {checkpoint_literal}\n"
    runtime_cfg_path.write_text(content, encoding="utf-8")
    return runtime_cfg_path


def _prepare_assets_cfg(runtime: _AnimationGPTRuntime, output_dir: Path) -> Path:
    try:
        content = runtime.assets_config_path.read_text(encoding="utf-8")
    except OSError:
        return runtime.assets_config_path

    updated = content
    if _use_nested_t2m_assets(runtime):
        updated = updated.replace("MEAN_STD_PATH: deps/t2m/", "MEAN_STD_PATH: deps/t2m/t2m/")
        updated = updated.replace("t2m_path: deps/t2m/", "t2m_path: deps/t2m/t2m/")
    if _use_nested_glove_assets(runtime):
        updated = updated.replace(
            "WORD_VERTILIZER_PATH: deps/glove/",
            "WORD_VERTILIZER_PATH: deps/t2m/glove/",
        )
    if updated == content:
        return runtime.assets_config_path

    output_dir.mkdir(parents=True, exist_ok=True)
    runtime_assets_path = output_dir / "assets.runtime.yaml"
    runtime_assets_path.write_text(updated, encoding="utf-8")
    return runtime_assets_path


def _use_nested_t2m_assets(runtime: _AnimationGPTRuntime) -> bool:
    direct_meta = (
        runtime.motiongpt_root
        / "deps"
        / "t2m"
        / "t2m"
        / "VQVAEV3_CB1024_CMT_H1024_NRES3"
        / "meta"
        / "mean.npy"
    )
    nested_meta = (
        runtime.motiongpt_root
        / "deps"
        / "t2m"
        / "t2m"
        / "t2m"
        / "VQVAEV3_CB1024_CMT_H1024_NRES3"
        / "meta"
        / "mean.npy"
    )
    return not direct_meta.exists() and nested_meta.exists()


def _use_nested_glove_assets(runtime: _AnimationGPTRuntime) -> bool:
    direct_glove = runtime.motiongpt_root / "deps" / "glove" / "our_vab_words.pkl"
    nested_glove = (
        runtime.motiongpt_root / "deps" / "t2m" / "glove" / "our_vab_words.pkl"
    )
    return not direct_glove.exists() and nested_glove.exists()


class AnimationGPTAdapter(BaseAdapter):
    provider_id = "animationgpt_local"
    modality = "motion"
    max_concurrency = 1

    def validate(self, uir: Dict[str, Any]) -> None:
        validate_uir(uir)
        motion = _motion_section(uir)
        if motion.get("enabled") and not _prompt_from_motion(motion):
            raise ValueError("modules.motion.prompt is required when motion.enabled=true")
        fps = _fps_from_motion(motion)
        if fps < 15 or fps > 60:
            raise ValueError("modules.motion.fps must be between 15 and 60")
        duration = _duration_from_uir(uir, motion)
        if duration is None:
            raise ValueError("missing duration_s")
        if duration < 1 or duration > 60:
            raise ValueError("duration_s must be between 1 and 60")
        job_id = _job_id_from_uir(uir)
        _assert_output_dir_writable(job_id, self.modality)

    def run(
        self, uir: Dict[str, Any], out_dir: Path, reporter: ProgressReporter
    ) -> AdapterResult:
        warnings: List[str] = []
        job_id = ""
        try:
            job_id = _job_id_from_uir(uir)
        except ValueError as exc:
            return _error_result(
                self.provider_id,
                warnings,
                build_error("E_VALIDATION_INPUT", str(exc), retryable=False),
            )

        log_path = _resolve_log_path(out_dir, job_id)
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_IO_WRITE",
                    "failed to create log directory",
                    detail={"path": str(log_path.parent), "error": str(exc)},
                    retryable=True,
                ),
            )

        with log_path.open("a", encoding="utf-8") as log_handle:
            try:
                self.validate(uir)
            except Exception as exc:
                _log_line(log_handle, f"[validate] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_VALIDATION_INPUT",
                        "validation failed",
                        detail={"error": str(exc)},
                        retryable=False,
                    ),
                )

            output_dir: Optional[Path] = None
            try:
                output_dir = self.output_dir(out_dir)
                _assert_dir_writable(output_dir)
            except OSError as exc:
                _log_line(log_handle, f"[io] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "output directory is not writable",
                        detail={
                            "path": str(output_dir or out_dir),
                            "error": str(exc),
                        },
                        retryable=True,
                    ),
                )

            motion = _motion_section(uir)
            prompt = _prompt_from_motion(motion)
            fps = _fps_from_motion(motion)
            duration_s = _duration_from_uir(uir, motion) or 0.0
            quality, quality_settings, quality_warning = _quality_settings_from_uir(uir)
            runtime = _resolve_runtime_paths()
            if quality_warning:
                warnings.append(quality_warning)
            if not prompt:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_VALIDATION_INPUT",
                        "modules.motion.prompt is required",
                        retryable=False,
                    ),
                )

            reporter.stage("prepare", 0.1, "preparing AnimationGPT inputs")
            _log_line(log_handle, f"[prepare] job_id={job_id} prompt={prompt!r}")

            example_path = output_dir / "motion_prompt.txt"
            try:
                example_path.write_text(f"{prompt}\n", encoding="utf-8")
            except OSError as exc:
                _log_line(log_handle, f"[io] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "failed to write prompt file",
                        detail={"path": str(example_path), "error": str(exc)},
                        retryable=True,
                    ),
                )

            reporter.stage("running", 0.5, "running AnimationGPT demo")
            start_time = time.time()
            missing = _missing_dependencies(runtime)
            if missing:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_DEPENDENCY_MISSING",
                        "AnimationGPT scripts are missing",
                        detail={"missing": missing},
                        retryable=False,
                    ),
                )
            assets_cfg_path = _prepare_assets_cfg(runtime, output_dir)
            demo_python = _resolve_python_exe()
            use_wsl = should_use_wsl(demo_python)
            demo_cfg_path = _prepare_demo_cfg(runtime, output_dir, use_wsl=use_wsl)
            demo_env = _build_demo_env(uir, runtime, use_wsl=use_wsl)
            demo_cmd = _build_demo_cmd(
                demo_python,
                example_path,
                runtime,
                demo_cfg_path,
                assets_cfg_path,
                use_wsl=use_wsl,
            )
            run_env = demo_env
            demo_cwd: Optional[Path] = runtime.motiongpt_root
            if use_wsl:
                demo_cmd = build_wsl_command(
                    demo_cmd,
                    env=demo_env,
                    distro=wsl_distro(),
                    cwd=to_wsl_path(runtime.motiongpt_root),
                )
                run_env = os.environ.copy()
                demo_cwd = None
            _log_line(log_handle, "[running] " + " ".join(demo_cmd))
            timeout_s = _timeout_from_uir(uir)
            demo_result = _run_subprocess(
                demo_cmd,
                cwd=demo_cwd,
                env=run_env,
                log_handle=log_handle,
                timeout_s=timeout_s,
                cancel_check=reporter.is_canceled,
            )
            if demo_result.timed_out:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_TIMEOUT",
                        "AnimationGPT timed out",
                        detail={"timeout_s": timeout_s},
                        retryable=True,
                    ),
                )
            if demo_result.return_code != 0:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_MODEL_RUNTIME",
                        "AnimationGPT demo failed",
                        detail={"exit_code": demo_result.return_code, "log": str(log_path)},
                        retryable=True,
                    ),
                )

            try:
                samples_dir = _find_latest_samples_dir(start_time, runtime)
                npy_path, multiple = _find_output_npy(samples_dir)
                if multiple:
                    warnings.append(
                        f"multiple output npy files found; using {npy_path.name}"
                    )
            except FileNotFoundError as exc:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "AnimationGPT output not found",
                        detail={"error": str(exc)},
                        retryable=True,
                    ),
                )

            motion_npy_path = output_dir / "motion_out.npy"
            try:
                shutil.copyfile(npy_path, motion_npy_path)
            except OSError as exc:
                _log_line(log_handle, f"[io] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "failed to copy motion npy",
                        detail={"path": str(motion_npy_path), "error": str(exc)},
                        retryable=True,
                    ),
                )

            reporter.stage("finalize", 0.9, "converting motion to BVH")
            bvh_path = output_dir / "motion.bvh"
            try:
                frames = _convert_npy_to_bvh(
                    npy_path=npy_path,
                    bvh_path=bvh_path,
                    fps=fps,
                    quality=quality,
                    quality_settings=quality_settings,
                    runtime=runtime,
                    log_handle=log_handle,
                )
            except ImportError as exc:
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_DEPENDENCY_MISSING",
                        "missing dependencies for BVH conversion",
                        detail={"error": str(exc)},
                        retryable=False,
                    ),
                )
            except Exception as exc:
                _log_line(log_handle, f"[convert] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_MODEL_RUNTIME",
                        "BVH conversion failed",
                        detail={"error": str(exc)},
                        retryable=True,
                    ),
                )
            if not bvh_path.exists():
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "BVH output missing",
                        detail={"path": str(bvh_path)},
                        retryable=True,
                    ),
                )

            actual_duration = frames / float(fps)
            if abs(actual_duration - duration_s) > (1.0 / float(fps)):
                warnings.append(
                    f"generated duration {actual_duration:.2f}s differs from requested {duration_s:.2f}s"
                )

            meta = {
                "fps": fps,
                "duration_s": actual_duration,
                "requested_duration_s": duration_s,
                "frames": frames,
                "skeleton": "SMPL_22",
                "source_provider": self.provider_id,
                "prompt_used": prompt,
                "quality": quality,
            }
            meta_path = output_dir / "motion_meta.json"
            try:
                meta_path.write_text(
                    json.dumps(meta, ensure_ascii=True, indent=2),
                    encoding="utf-8",
                )
            except OSError as exc:
                _log_line(log_handle, f"[io] {exc}")
                return _error_result(
                    self.provider_id,
                    warnings,
                    build_error(
                        "E_IO_WRITE",
                        "failed to write motion_meta.json",
                        detail={"path": str(meta_path), "error": str(exc)},
                        retryable=True,
                    ),
                )

            artifacts = [
                build_asset_ref(bvh_path, job_id, "motion_bvh", "text/plain"),
                build_asset_ref(
                    motion_npy_path, job_id, "motion_npy", "application/octet-stream"
                ),
                build_asset_ref(
                    meta_path, job_id, "motion_meta", "application/json"
                ),
            ]
            reporter.stage("finalize", 1.0, "motion artifacts ready")
            return {
                "ok": True,
                "provider": self.provider_id,
                "artifacts": artifacts,
                "meta": {
                    "fps": fps,
                    "duration_s": actual_duration,
                    "frames": frames,
                },
                "warnings": warnings,
                "error": None,
            }


def _error_result(
    provider: str, warnings: List[str], error: Dict[str, Any]
) -> AdapterResult:
    return {
        "ok": False,
        "provider": provider,
        "artifacts": [],
        "meta": {},
        "warnings": warnings,
        "error": error,
    }


def _job_id_from_uir(uir: Dict[str, Any]) -> str:
    job = uir.get("job")
    if isinstance(job, dict):
        job_id = job.get("id")
        if job_id:
            return str(job_id)
    raise ValueError("missing job.id")


def _motion_section(uir: Dict[str, Any]) -> Dict[str, Any]:
    modules = uir.get("modules")
    if isinstance(modules, dict):
        motion = modules.get("motion")
        if isinstance(motion, dict):
            return motion
    return {}


def _prompt_from_motion(motion: Dict[str, Any]) -> str:
    prompt = motion.get("prompt")
    if isinstance(prompt, str):
        return prompt.strip()
    return ""


def _fps_from_motion(motion: Dict[str, Any]) -> int:
    fps = motion.get("fps", 30)
    try:
        return int(fps)
    except (TypeError, ValueError):
        return 30


def _duration_from_uir(uir: Dict[str, Any], motion: Dict[str, Any]) -> Optional[float]:
    duration = motion.get("duration_s")
    if duration is None:
        intent = uir.get("intent")
        if isinstance(intent, dict):
            duration = intent.get("duration_s")
    if duration is None:
        return None
    try:
        return float(duration)
    except (TypeError, ValueError):
        return None


def _timeout_from_uir(uir: Dict[str, Any]) -> Optional[float]:
    constraints = uir.get("constraints")
    if not isinstance(constraints, dict):
        return None
    timeout = constraints.get("max_runtime_s")
    if timeout is None:
        return None
    try:
        return float(timeout)
    except (TypeError, ValueError):
        return None


def _quality_settings_from_uir(
    uir: Dict[str, Any],
) -> Tuple[str, Dict[str, Any], Optional[str]]:
    constraints = uir.get("constraints")
    quality = None
    if isinstance(constraints, dict):
        quality = constraints.get("quality")
    quality_label = "standard"
    warning = None
    if isinstance(quality, str) and quality:
        quality_label = quality.lower()
    if quality_label not in {"fast", "standard", "high"}:
        warning = f"unsupported quality '{quality_label}', using standard"
        quality_label = "standard"
    if quality_label == "fast":
        return quality_label, {"iterations": 5, "foot_ik": False}, warning
    if quality_label == "high":
        return quality_label, {"iterations": 20, "foot_ik": True}, warning
    return quality_label, {"iterations": 10, "foot_ik": False}, warning


def _assert_output_dir_writable(job_id: str, modality: str) -> None:
    runtime_paths = get_runtime_paths()
    job_dir = runtime_paths.assets_dir / job_id
    output_dir = job_dir / modality
    _assert_dir_writable(output_dir)


def _assert_dir_writable(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    probe = path / ".write_check"
    probe.write_text("ok", encoding="utf-8")
    probe.unlink()


def _resolve_log_path(out_dir: Path, job_id: str) -> Path:
    job_dir = _find_job_dir(out_dir, job_id)
    if job_dir is not None:
        return job_dir / "logs" / "motion.log"
    return out_dir.parent / "logs" / "motion.log"


def _find_job_dir(out_dir: Path, job_id: str) -> Optional[Path]:
    if not job_id:
        return None
    for parent in (out_dir, *out_dir.parents):
        if parent.name == job_id:
            return parent
    runtime_paths = get_runtime_paths()
    candidate = runtime_paths.assets_dir / job_id
    if candidate.exists():
        return candidate
    return None


def _build_demo_env(
    uir: Dict[str, Any], runtime: _AnimationGPTRuntime, *, use_wsl: bool
) -> Dict[str, str]:
    env_overrides: Dict[str, str] = {"PYTHONIOENCODING": "utf-8"}
    python_paths = [
        str(runtime.motiongpt_root),
        str(runtime.animationgpt_root / "algorithm" / "HumanML3D"),
    ]
    existing = os.environ.get("PYTHONPATH")
    if existing:
        python_paths.extend(path for path in existing.split(os.pathsep) if path)
    if use_wsl:
        python_paths = [to_wsl_path(path) for path in python_paths]
        env_overrides["PYTHONPATH"] = ":".join(python_paths)
    else:
        env_overrides["PYTHONPATH"] = os.pathsep.join(python_paths)
    gpu_lock = _gpu_lock_from_uir(uir)
    if gpu_lock is not None:
        env_overrides["CUDA_VISIBLE_DEVICES"] = gpu_lock
    force_weights_only = os.environ.get("TORCH_FORCE_WEIGHTS_ONLY_LOAD")
    force_no_weights_only = os.environ.get("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD")
    if force_weights_only:
        env_overrides["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = force_weights_only
    else:
        env_overrides["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = (
            force_no_weights_only or "1"
        )
    if use_wsl:
        return env_overrides
    env = dict(os.environ)
    env.update(env_overrides)
    return env


def _build_demo_cmd(
    python_exe: str,
    example_path: Path,
    runtime: _AnimationGPTRuntime,
    config_path: Path,
    assets_config_path: Path,
    *,
    use_wsl: bool,
) -> List[str]:
    python_bin = to_wsl_path(python_exe) if use_wsl else python_exe

    def path_mapper(path: Path) -> str:
        resolved = path.resolve()
        return to_wsl_path(resolved) if use_wsl else str(resolved)

    return [
        python_bin,
        path_mapper(runtime.demo_script),
        "--cfg",
        path_mapper(config_path),
        "--cfg_assets",
        path_mapper(assets_config_path),
        "--example",
        path_mapper(example_path),
    ]


def _gpu_lock_from_uir(uir: Dict[str, Any]) -> Optional[str]:
    runtime = uir.get("runtime")
    if not isinstance(runtime, dict):
        return None
    locks = runtime.get("locks")
    if not isinstance(locks, dict):
        return None
    gpu = locks.get("gpu")
    if isinstance(gpu, str) and gpu:
        value = gpu.strip()
    elif isinstance(gpu, int):
        value = str(gpu)
    else:
        return None
    if value.startswith("cuda:"):
        return value.split("cuda:", 1)[-1]
    return value


class _SubprocessResult:
    def __init__(self, return_code: int, timed_out: bool) -> None:
        self.return_code = return_code
        self.timed_out = timed_out


def _run_subprocess(
    cmd: List[str],
    cwd: Optional[Path],
    env: Dict[str, str],
    log_handle: Any,
    timeout_s: Optional[float],
    cancel_check: Optional[Callable[[], bool]] = None,
) -> _SubprocessResult:
    try:
        completed = run_subprocess(
            cmd,
            cwd=cwd,
            env=env,
            timeout_s=timeout_s,
            log_handle=log_handle,
            cancel_check=cancel_check,
        )
    except subprocess.TimeoutExpired:
        _log_line(log_handle, "[timeout] AnimationGPT demo timed out")
        return _SubprocessResult(return_code=1, timed_out=True)
    return _SubprocessResult(return_code=completed.returncode, timed_out=False)


def _find_latest_samples_dir(start_time: float, runtime: _AnimationGPTRuntime) -> Path:
    threshold = start_time - 2.0
    search_roots = [
        runtime.motiongpt_root / "results",
        runtime.motiongpt_root / "output",
        runtime.animationgpt_root / "results",
        runtime.motiongpt_root,
    ]
    candidates: List[Tuple[float, Path]] = []
    for root in search_roots:
        if not root.exists():
            continue
        for path in root.rglob("samples_*"):
            if not path.is_dir():
                continue
            mtime = path.stat().st_mtime
            if mtime >= threshold:
                candidates.append((mtime, path))
    if not candidates:
        for root in search_roots:
            if not root.exists():
                continue
            for path in root.rglob("samples_*"):
                if path.is_dir():
                    candidates.append((path.stat().st_mtime, path))
    if not candidates:
        raise FileNotFoundError("no samples_* directory found")
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _find_output_npy(samples_dir: Path) -> Tuple[Path, bool]:
    npy_files = sorted(samples_dir.glob("*_out.npy"))
    if not npy_files:
        raise FileNotFoundError(f"no *_out.npy in {samples_dir}")
    return npy_files[0], len(npy_files) > 1


def _convert_npy_to_bvh(
    npy_path: Path,
    bvh_path: Path,
    fps: int,
    quality: str,
    quality_settings: Dict[str, Any],
    runtime: _AnimationGPTRuntime,
    log_handle: Any,
) -> int:
    import numpy as np

    npy_path = npy_path.resolve()
    bvh_path = bvh_path.resolve()
    bvh_path.parent.mkdir(parents=True, exist_ok=True)
    joints = np.load(str(npy_path))
    if joints.ndim == 4 and joints.shape[0] == 1:
        joints = joints[0]
    if joints.ndim != 3 or joints.shape[-1] != 3:
        raise ValueError(f"unexpected motion shape: {joints.shape}")

    iterations = int(quality_settings.get("iterations", 10))
    foot_ik = bool(quality_settings.get("foot_ik", False))
    _log_line(
        log_handle,
        f"[convert] quality={quality} iterations={iterations} foot_ik={foot_ik}",
    )
    with _temp_sys_path(runtime.npy_to_bvh_dir), _pushd(runtime.npy_to_bvh_dir):
        module = _load_joints2bvh_module(runtime)
        with redirect_stdout(log_handle), redirect_stderr(log_handle):
            converter = module.Joint2BVHConvertor()
            anim, _ = converter.convert(
                joints, None, iterations=iterations, foot_ik=foot_ik
            )
            module.BVH.save(
                str(bvh_path),
                anim,
                names=anim.names,
                frametime=1.0 / float(fps),
                order="zyx",
                quater=True,
            )
    return int(joints.shape[0])


def _load_joints2bvh_module(runtime: _AnimationGPTRuntime) -> Any:
    module = sys.modules.get("animationgpt_joints2bvh")
    if module is not None:
        return module
    spec = importlib.util.spec_from_file_location(
        "animationgpt_joints2bvh", runtime.joints2bvh_path
    )
    if spec is None or spec.loader is None:
        raise ImportError("unable to load joints2bvh module")
    module = importlib.util.module_from_spec(spec)
    sys.modules["animationgpt_joints2bvh"] = module
    spec.loader.exec_module(module)
    return module


def _missing_dependencies(runtime: _AnimationGPTRuntime) -> List[str]:
    missing: List[str] = []
    if not runtime.demo_script.exists():
        missing.append(str(runtime.demo_script))
    if not runtime.config_path.exists():
        missing.append(str(runtime.config_path))
    if not runtime.checkpoint_path.exists():
        missing.append(str(runtime.checkpoint_path))
    if not runtime.joints2bvh_path.exists():
        missing.append(str(runtime.joints2bvh_path))
    return missing


@contextmanager
def _temp_sys_path(path: Path) -> Any:
    path_str = str(path)
    added = False
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
        added = True
    try:
        yield
    finally:
        if added:
            sys.path.remove(path_str)


@contextmanager
def _pushd(path: Path) -> Any:
    prev = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(prev)


def _log_line(handle: Any, line: str) -> None:
    handle.write(line.rstrip() + "\n")
    handle.flush()


def _resolve_python_exe() -> str:
    python_exe = os.getenv("ANIMATIONGPT_PYTHON") or os.getenv("PYTHON_EXE")
    if python_exe:
        return python_exe
    return sys.executable
