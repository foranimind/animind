from __future__ import annotations

import json
import os
import shutil
import time
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import (
    AdapterResult,
    BaseAdapter,
    ProgressReporter,
    build_asset_ref,
    build_error,
    run_subprocess,
)
from ..uir.validate import validate_uir

_REPO_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_BIN = _REPO_ROOT / "musicgpt-x86_64-pc-windows-msvc.exe"


class MusicGPTCliAdapter(BaseAdapter):
    provider_id = "musicgpt_cli"
    modality = "music"
    max_concurrency = 1

    def validate(self, uir: Dict[str, Any]) -> None:
        validate_uir(uir)
        music = _music_section(uir)
        if music.get("enabled") and not _prompt_from_music(music):
            raise ValueError("modules.music.prompt is required when music.enabled=true")

    def run(
        self, uir: Dict[str, Any], out_dir: Path, reporter: ProgressReporter
    ) -> AdapterResult:
        warnings: List[str] = []
        try:
            job_id = _job_id_from_uir(uir)
        except ValueError as exc:
            return _error_result(
                self.provider_id,
                warnings,
                build_error("E_VALIDATION_INPUT", str(exc), retryable=False),
            )

        prompt_original = _prompt_from_music(_music_section(uir))
        if not prompt_original:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_VALIDATION_INPUT",
                    "modules.music.prompt is required",
                    retryable=False,
                ),
            )
        duration_s = _duration_from_uir(uir)
        if duration_s is None:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_VALIDATION_INPUT",
                    "missing duration_s",
                    retryable=False,
                ),
            )

        prompt_used = _build_music_prompt(uir, out_dir, job_id, prompt_original, warnings)
        exe_path = _resolve_musicgpt_bin()
        if exe_path is None:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_DEPENDENCY_MISSING",
                    "musicgpt executable not found",
                    detail={"expected": str(_DEFAULT_BIN)},
                    retryable=False,
                ),
            )

        output_dir = self.output_dir(out_dir)
        output_path = output_dir / "music.wav"
        meta_path = output_dir / "music_meta.json"
        log_path = _resolve_log_path(out_dir, job_id)

        reporter.stage("prepare", 0.1, "preparing MusicGPT input")
        cmd = [
            str(exe_path),
            prompt_used,
            "--secs",
            str(int(duration_s)),
            "--no-playback",
            "--no-interactive",
            "--output",
            str(output_path),
        ]
        env = os.environ.copy()
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("a", encoding="utf-8") as log_handle:
                reporter.stage("running", 0.5, "running MusicGPT")
                log_handle.write("[cmd] " + " ".join(cmd) + "\n")
                log_handle.flush()
                result = run_subprocess(
                    cmd,
                    env=env,
                    log_handle=log_handle,
                    cancel_check=reporter.is_canceled,
                )
        except OSError as exc:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_IO_WRITE",
                    "failed to run musicgpt",
                    detail={"error": str(exc)},
                    retryable=True,
                ),
            )

        if result.returncode != 0:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_MODEL_RUNTIME",
                    "musicgpt process failed",
                    detail={"return_code": result.returncode, "log": str(log_path)},
                    retryable=True,
                ),
            )

        if not _wait_for_file(output_path, timeout_s=20.0):
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_IO_WRITE",
                    "musicgpt output missing",
                    detail={"path": str(output_path)},
                    retryable=True,
                ),
            )

        sample_rate, channels = _wav_meta(output_path)
        meta = {
            "duration_s": float(duration_s),
            "sample_rate": sample_rate,
            "channels": channels,
            "provider": self.provider_id,
            "prompt_original": prompt_original,
            "prompt_used": prompt_used,
            "cmdline": " ".join(cmd),
        }
        try:
            meta_path.write_text(
                json.dumps(meta, ensure_ascii=True, indent=2), encoding="utf-8"
            )
        except OSError as exc:
            return _error_result(
                self.provider_id,
                warnings,
                build_error(
                    "E_IO_WRITE",
                    "failed to write music_meta.json",
                    detail={"path": str(meta_path), "error": str(exc)},
                    retryable=True,
                ),
            )

        artifacts = [
            build_asset_ref(output_path, job_id, "music_wav", "audio/wav"),
            build_asset_ref(meta_path, job_id, "music_meta", "application/json"),
        ]
        reporter.stage("finalize", 1.0, "music artifacts ready")
        return {
            "ok": True,
            "provider": self.provider_id,
            "artifacts": artifacts,
            "meta": {"duration_s": float(duration_s)},
            "warnings": warnings,
            "error": None,
        }


def _resolve_musicgpt_bin() -> Optional[Path]:
    env_path = os.getenv("MUSICGPT_BIN")
    if env_path:
        candidate = Path(env_path)
        if candidate.exists():
            return candidate
    if _DEFAULT_BIN.exists():
        return _DEFAULT_BIN
    found = shutil.which("musicgpt")
    if found:
        return Path(found)
    found = shutil.which("musicgpt.exe")
    if found:
        return Path(found)
    return None


def _wait_for_file(path: Path, timeout_s: float) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if path.exists() and path.stat().st_size > 0:
            return True
        time.sleep(0.2)
    return False


def _wav_meta(path: Path) -> tuple[Optional[int], Optional[int]]:
    try:
        with wave.open(str(path), "rb") as handle:
            return handle.getframerate(), handle.getnchannels()
    except (OSError, wave.Error):
        return None, None


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


def _music_section(uir: Dict[str, Any]) -> Dict[str, Any]:
    modules = uir.get("modules")
    if isinstance(modules, dict):
        music = modules.get("music")
        if isinstance(music, dict):
            return music
    return {}


def _motion_section(uir: Dict[str, Any]) -> Dict[str, Any]:
    modules = uir.get("modules")
    if isinstance(modules, dict):
        motion = modules.get("motion")
        if isinstance(motion, dict):
            return motion
    return {}


def _prompt_from_music(music: Dict[str, Any]) -> str:
    prompt = music.get("prompt")
    if isinstance(prompt, str):
        return prompt.strip()
    return ""


def _duration_from_uir(uir: Dict[str, Any]) -> Optional[float]:
    music = _music_section(uir)
    duration = music.get("duration_s")
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


def _resolve_log_path(out_dir: Path, job_id: str) -> Path:
    job_dir = _find_job_dir(out_dir, job_id)
    if job_dir is not None:
        return job_dir / "logs" / "music.log"
    return out_dir.parent / "logs" / "music.log"


def _find_job_dir(out_dir: Path, job_id: str) -> Optional[Path]:
    if not job_id:
        return None
    for parent in (out_dir, *out_dir.parents):
        if parent.name == job_id:
            return parent
    return None


def extract_motion_energy(npy_path: Path, fps: float = 20.0) -> tuple[List[float], List[int]]:
    """
    从 motion_out.npy 提取动作能量曲线与峰值帧索引。
    兼容 (F, J, 3) 和 (1, F, J, 3) 两种输出。
    """
    import numpy as np
    from scipy.signal import find_peaks

    arr = np.load(npy_path, allow_pickle=True)
    if arr.ndim == 4 and arr.shape[0] == 1:
        arr = arr[0]
    if arr.ndim != 3:
        raise ValueError(f"Unexpected NPY shape: {arr.shape}, expected (F, J, 3)")
    frames, _joints, coords = arr.shape
    if coords != 3:
        raise ValueError(f"Last dim must be 3 coordinates, got {coords}")
    if frames < 2:
        return [], []

    velocity = np.linalg.norm(arr[1:] - arr[:-1], axis=2)
    energy = velocity.mean(axis=1)

    if len(energy) > 3:
        kernel = np.ones(3, dtype=np.float32) / 3.0
        energy_smooth = np.convolve(energy, kernel, mode="same")
    else:
        energy_smooth = energy

    distance = max(1, int(fps * 0.25))
    std_val = float(np.std(energy_smooth))
    prominence = std_val * 0.1 if std_val > 0 else 0.0
    peaks, _ = find_peaks(energy_smooth, distance=distance, prominence=prominence)
    return energy_smooth.tolist(), peaks.tolist()


def build_rhythm_prompt(
    text_prompt: str, peaks: List[int], energy: List[float], fps: float = 20.0
) -> str:
    """
    根据动作能量和峰值，生成 MusicGPT 能理解的节奏提示。
    """
    peaks = list(peaks or [])
    energy = list(energy or [])

    if energy:
        avg_energy = float(sum(energy) / len(energy))
        peak_energy = float(max(energy))
    else:
        avg_energy = 0.0
        peak_energy = 0.0

    if peak_energy <= 0 or avg_energy <= 0:
        intensity_desc = (
            "The overall motion intensity is relatively low, so the music can stay more subtle, "
            "with soft rhythmic pulses and occasional accents that do not dominate the scene."
        )
    elif peak_energy > avg_energy * 1.6:
        intensity_desc = (
            "The action contains frequent high-energy impacts, so the music should stay fast, "
            "intense, and rhythmic with strong percussion and clearly defined downbeats."
        )
    else:
        intensity_desc = (
            "The action has moderate intensity, so the music should maintain a clear beat with "
            "regular accents, balancing tension and breathing space."
        )

    if not peaks:
        return (
            "Generate background music for a combat animation.\n\n"
            "Action description:\n"
            f"{text_prompt}\n\n"
            "Rhythm alignment instructions:\n"
            "- Use a clear, steady beat that matches the overall pace of the movement.\n"
            "- Emphasize stronger drum hits during visually intense moments of the motion.\n"
            "- Keep a coherent tempo suitable for action scenes.\n"
            "- Style suggestion: If no specific style was provided, use an epic battle style with percussion accents.\n\n"
            f"{intensity_desc}"
        )

    offset_frames = max(1, int(0.5 * fps))
    adjusted_peaks = [max(0, int(peak) - offset_frames) for peak in peaks]
    peak_times = [round(peak / fps, 2) for peak in adjusted_peaks]
    peak_times_short = peak_times[:6]
    peak_str = ", ".join(f"{t}s" for t in peak_times_short)

    return (
        "Generate background music for a combat animation.\n\n"
        "Action description:\n"
        f"{text_prompt}\n\n"
        "Rhythm alignment instructions:\n"
        f"- Rhythmic hits should occur on the downbeats at {peak_str}.\n"
        f"- Place clear percussive hits (e.g., low drum or impact sounds) exactly at each of: {peak_str}.\n"
        "- Treat these times as the main rhythmic anchors, keeping the core beat locked to these impacts.\n"
        "- Between these impacts, keep a driving rhythm that smoothly connects one hit to the next.\n"
        "- Keep the tempo consistent and suitable for an action / battle scene.\n"
        "- Style suggestion: epic orchestral battle music with strong drums and percussion, supporting the sense of momentum.\n\n"
        f"{intensity_desc}"
    )


def _build_music_prompt(
    uir: Dict[str, Any],
    out_dir: Path,
    job_id: str,
    prompt_original: str,
    warnings: List[str],
) -> str:
    motion = _motion_section(uir)
    motion_prompt = motion.get("prompt")
    if not isinstance(motion_prompt, str) or not motion_prompt.strip():
        return prompt_original

    job_dir = _find_job_dir(out_dir, job_id) or out_dir
    motion_npy = _find_motion_npy(job_dir)
    if motion_npy is None:
        return prompt_original

    fps = _motion_fps(motion)
    try:
        energy, peaks = extract_motion_energy(motion_npy, fps=fps)
    except Exception as exc:
        warnings.append(f"motion rhythm adapter skipped: {exc}")
        return prompt_original

    rhythm_prompt = build_rhythm_prompt(motion_prompt.strip(), peaks, energy, fps=fps)
    return (
        "Create background music for the following animation.\n\n"
        "Music style requirement:\n"
        f"{prompt_original}\n\n"
        f"{rhythm_prompt}"
    )


def _find_motion_npy(job_dir: Path) -> Optional[Path]:
    fallback = job_dir / "motion" / "motion_out.npy"
    if fallback.exists():
        return fallback
    motion_dir = job_dir / "motion"
    if not motion_dir.exists():
        return None
    matches = sorted(motion_dir.glob("*_out.npy"), key=lambda path: path.stat().st_mtime)
    if matches:
        return matches[-1]
    return None


def _motion_fps(motion: Dict[str, Any]) -> float:
    fps = motion.get("fps", 30)
    try:
        return float(fps)
    except (TypeError, ValueError):
        return 30.0
