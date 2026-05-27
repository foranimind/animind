[English](README_EN.md) | [Chinese](README.md)

# Animind Digital Human Animation Generation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Animind is a localized workflow for digital human animation and multimodal generation, covering a task-orchestration backend, web frontend, and model adapters. The system uses UIR (Unified Intermediate Representation) to drive scene/motion/music/character/preview/export modules, enabling the full pipeline from prompt to asset generation, preview, and export.

## Table of Contents

- [Core Capabilities](#features)
- [Directory Structure](#structure)
- [Requirements](#requirements)
- [Quick Start (Frontend Mock Only)](#quickstart-mock)
- [Installation and Setup (Full Pipeline)](#setup)
- [Start Services](#start)
- [API Quick Reference](#api)
- [Prompt Mode Parameters (/api/jobs)](#prompt-mode)
- [Runtime Outputs](#runtime)
- [Quick Verification (API)](#quick-verify)
- [Tests](#tests)
- [Docs](#docs)
- [Contributing](#contributing)
- [License](#license)
- [FAQ](#faq)

<a id="features"></a>
## Core Capabilities

- Orchestrator orchestration: task queue, stage-based state machine, progress and logs, SSE/WS event streams, manifest asset list
- Multi-model adapters: AnimationGPT (motion), Diffusion360 (scene), MusicGPT (music), built-in character library (character), Three.js preview config, ffmpeg export
- Localized runtime: native Windows/Linux; run Linux models via WSL when needed
- Cloud extension: optional Relay keeps heavy model execution on a local GPU machine while a cloud orchestrator owns routing and user traffic
- Frontend experience: React + Vite + Three.js, supports Mock mode and local preview

<a id="structure"></a>
## Directory Structure

- `apps/web` - New web frontend
- `services/orchestrator` - Backend orchestrator service
- `services/relay` - Local GPU relay service for cloud-connected deployments
- `deploy` - Environment examples, systemd units, Nginx config, and deployment scripts
- `docs` - API/UIR/Relay design docs
- `tests` - Backend unit tests
- `runtime` - Runtime outputs (assets/cache/logs)
- `third_party` - Third-party model submodules
- `tools` - Tools and third-party components

<a id="requirements"></a>
## Requirements

- OS: Windows 10/11 or Linux
- Python 3.9-3.11 (backend)
- Node.js 18+ (frontend, Vite 6)
- Git (with submodules)
- Optional: NVIDIA GPU + CUDA (model inference)
- Optional: WSL2 (when calling Linux environment models)

<a id="quickstart-mock"></a>
## Quick Start (Frontend Mock Only)

You can browse the UI without backend or models:

```bash
cd apps/web
npm install
VITE_USE_MOCK=1 npm run dev
```

Open: `http://localhost:5173`  
Mock assets live under `apps/web/public/mock/assets/demo_job`.

<a id="setup"></a>
## Installation and Setup (Full Pipeline)

### 1) Clone code and submodules

```bash
git clone --recurse-submodules https://github.com/foranimind/animind.git
# If already cloned:
git submodule update --init --recursive
```

### 2) Backend Python environment

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/macOS
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) Frontend dependencies

```bash
cd apps/web
npm install
```

### 4) Third-party models and tools (required for full pipeline)

- AnimationGPT (motion): `third_party/AnimationGPT`
  - Requires `third_party/AnimationGPT/algorithm/MotionGPT/mGPT.ckpt`
  - Install dependencies per upstream README: `pip install -r third_party/AnimationGPT/algorithm/MotionGPT/requirements.txt`
- Diffusion360 (scene): `third_party/SD-T2I-360PanoImage`
  - `models/` must include `sd-base/`, `sr-base/`, `sr-control/`, `RealESRGAN_x2plus.pth`
- MusicGPT (music):
  - Windows uses `musicgpt-x86_64-pc-windows-msvc.exe` in repo root by default
  - Or install a system binary and set `MUSICGPT_BIN`
- ffmpeg (export):
  - Install ffmpeg and set `FFMPEG_BIN` (use `FFMPEG_BIN_WSL` for WSL)

### 5) Frontend environment variables (apps/web)

- `VITE_DEV_PROXY_TARGET`: dev proxy backend address, default `http://localhost:8000`
- `VITE_API_BASE`: API base, empty means same-origin
- `VITE_USE_MOCK`: set to `1` to enable Mock mode
- `VITE_BASE`: deployment base path (optional)

Copy `apps/web/.env.example` to `.env.local` to configure.

### 6) Backend environment variables (Orchestrator)

| Variable | Description | Default/Notes |
| --- | --- | --- |
| `ORCH_RUNTIME_DIR` | Runtime directory | Default `runtime` |
| `ANIMATIONGPT_ROOT` | AnimationGPT root | Default `third_party/AnimationGPT` |
| `MOTIONGPT_ROOT` | MotionGPT directory | Default `third_party/AnimationGPT/algorithm/MotionGPT` |
| `ANIMATIONGPT_PYTHON` | Python for AnimationGPT | Required |
| `DIFFUSION360_ROOT` | Diffusion360 root | Default `third_party/SD-T2I-360PanoImage` |
| `DIFFUSION360_PYTHON` | Python for Diffusion360 | Required |
| `DIFFUSION360_DEVICE` | `cuda`/`cuda:0`/`cpu` | Optional |
| `DIFFUSION360_DISABLE_XFORMERS` | Disable xformers | Default 1 |
| `MUSICGPT_BIN` | MusicGPT executable | Required if not default |
| `ANIMATION_PY` | `animation.py` path | Default `third_party/AnimationGPT/tools/animation.py` |
| `PYTHON_MP4_EXE` | Python for export | Defaults to `ANIMATIONGPT_PYTHON` or system Python |
| `FFMPEG_BIN` | ffmpeg executable | Required |
| `FFMPEG_BIN_WSL` | ffmpeg under WSL | When using WSL export |
| `WSL_DISTRO` | WSL distro | Default `Ubuntu` |

PowerShell example:

```powershell
$env:ORCH_RUNTIME_DIR = "runtime"
$env:ANIMATIONGPT_PYTHON = "C:\path\to\python.exe"
$env:DIFFUSION360_PYTHON = "C:\path\to\python.exe"
$env:DIFFUSION360_DEVICE = "cuda:0"
$env:MUSICGPT_BIN = "E:\path\to\musicgpt.exe"
$env:FFMPEG_BIN = "C:\path\to\ffmpeg.exe"
$env:WSL_DISTRO = "Ubuntu"
```

Bash example:

```bash
export ORCH_RUNTIME_DIR=runtime
export ANIMATIONGPT_PYTHON=/path/to/python
export DIFFUSION360_PYTHON=/path/to/python
export DIFFUSION360_DEVICE=cuda:0
export MUSICGPT_BIN=/path/to/musicgpt
export FFMPEG_BIN=/usr/bin/ffmpeg
export WSL_DISTRO=Ubuntu
```

Tip: When `ANIMATIONGPT_PYTHON` or `DIFFUSION360_PYTHON` points to a Linux path (such as `/home/...` or `\\wsl$\\...`), the system automatically executes via WSL.

### 7) Relay environment variables (optional, cloud-connected mode)

Only configure these when you want a cloud entrypoint backed by a local GPU relay:

| Variable | Description | Default/Notes |
| --- | --- | --- |
| `RELAY_SHARED_TOKEN` | Relay inbound auth token | Required |
| `RELAY_RUNTIME_DIR` | Relay runtime directory | Default `relay_runtime` |
| `ORCHESTRATOR_BASE_URL` | Base URL of the cloud orchestrator | Required |
| `ORCHESTRATOR_RELAY_TOKEN` | Token used for relay uploads back to the orchestrator | Should match the shared token |

See `deploy/env/animind.relay.env.example` for a concrete example.

<a id="start"></a>
## Start Services

Backend (recommended Windows script):

```powershell
.\start_orchestrator.ps1 -Port 8000 -RuntimeDir runtime
```

Note: `start_orchestrator.ps1` contains example paths; update them for your environment. Use `-NoReload` to disable hot reload.

Backend (generic):

```bash
python -m uvicorn services.orchestrator.src.main:app --reload --port 8000
```

Frontend:

```bash
cd apps/web
npm run dev
```

Relay (optional):

```bash
python -m uvicorn services.relay.src.main:app --host 0.0.0.0 --port 9000
```

Open: `http://localhost:5173`

<a id="api"></a>
## API Quick Reference

- `POST /api/jobs`: create job (prompt + options or direct UIR)
- `GET /api/jobs/{job_id}`: query status and assets
- `GET /api/jobs/{job_id}/events`: SSE event stream
- `WS /ws/jobs/{job_id}`: WebSocket event stream
- `GET /assets/{job_id}/...`: static assets (manifest / preview_config / scene / motion / music, etc.)

See: `docs/api.md`, `docs/uir_schema.md`.

<a id="prompt-mode"></a>
## Prompt Mode Parameters (/api/jobs)

`POST /api/jobs` in prompt mode accepts:

```json
{
  "prompt": "A warrior dashes forward",
  "options": {
    "targets": ["scene", "motion", "music"],
    "duration_s": 12,
    "style": "cinematic",
    "mood": "epic",
    "export_video": true,
    "export_preset": "mp4_1080p",
    "advanced": { "seed": 42, "resolution": [2048, 1024] }
  }
}
```

Common `options` fields:

- `targets`: list of outputs; supports `scene`, `motion`, `music`, `character`, `preview`, `export`
- `duration_s` / `style` / `mood`: duration and style information
- `export_video` / `export_preset`: export toggle and presets (such as `mp4_720p`, `mp4_1080p`, `mp4_4k`, `zip`)
- `advanced.seed` / `advanced.resolution`: scene seed and resolution
- `character_id`: select a built-in character
- `routing`: override model routing (such as `{"scene":{"provider":"diffusion360_local"}}`)

<a id="runtime"></a>
## Runtime Outputs

Outputs are written to `runtime/assets/<job_id>/` by default, with a typical structure:

```text
runtime/
  assets/<job_id>/
    manifest.json
    logs/
    scene/panorama.png
    motion/motion.bvh
    music/music.wav
    preview/preview_config.json
    export/final.mp4
```

<a id="quick-verify"></a>
## Quick Verification (API)

```bash
curl -X POST "http://localhost:8000/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"A warrior dashes forward\",\"options\":{\"targets\":[\"motion\",\"music\"],\"duration_s\":8}}"
```

If Relay is enabled, you can also run:

```bash
python tools/smoke/smoke_relay_task.py --base-url http://127.0.0.1:9000 --token "$RELAY_SHARED_TOKEN"
```

<a id="tests"></a>
## Tests

Backend:

```bash
python -m unittest discover -s tests
```

Frontend:

```bash
cd apps/web
npm run test
```

<a id="docs"></a>
## Docs

- `docs/api.md` - API conventions
- `docs/uir_schema.md` - UIR v1 schema
- `docs/relay_design.md` - Relay design (local GPU relay)
- `docs/deployment/cloud-relay-runbook.md` - Cloud entrypoint plus local GPU relay deployment flow
- `services/orchestrator/README.md` - Backend local smoke test
- `services/relay/README.md` - Relay local run and smoke-check notes
- `apps/web/README.md` - Frontend notes
- `CONTRIBUTING.md` - Repository contribution guide
- `docs/process/github-collaboration-guide.zh-CN.md` - Archived Chinese collaboration process guide

<a id="contributing"></a>
## Contributing

Issues and PRs are welcome. Please read `CONTRIBUTING.md` before submitting to follow the branch, commit, and review flow.

<a id="license"></a>
## License

This project uses the MIT License. See `LICENSE`. Components under `third_party` follow their own licenses.

<a id="faq"></a>
## FAQ

- `E_DEPENDENCY_MISSING`: check model weights, executables, and environment variables
- `DIFFUSION360_PYTHON not configured`: set `DIFFUSION360_PYTHON`
- `musicgpt executable not found`: verify `MUSICGPT_BIN` or system installation
- `ffmpeg executable not found`: install ffmpeg and set `FFMPEG_BIN`
- WSL path errors: ensure WSL is installed and set `WSL_DISTRO`
