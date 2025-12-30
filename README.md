# Animind 数字人动画生成平台

Animind 是一套面向数字人动画与多模态生成的本地化工作流，包含 Web 前端、任务编排后端以及多个模型适配器。后端以 UIR (统一中间表示) 驱动 scene/motion/music/preview/export 等模块，前端提供任务创建、进度跟踪与预览。

## 功能概览

- FastAPI Orchestrator: 任务编排、事件流 (SSE)、资源清单 (manifest)
- 模型适配器: AnimationGPT (motion)、Diffusion360 (scene)、MusicGPT (music)、ffmpeg 导出、Three.js 预览配置
- Web 前端: React + Vite, 支持 Mock 模式
- 可选 WSL 执行 Linux 环境模型

## 目录结构

- `apps/web` - 新版 Web 前端
- `services/orchestrator` - 后端编排服务
- `runtime` - 运行时产物 (assets/cache/logs)
- `third_party` - 第三方模型子模块
- `apps/web-legacy` - 旧版前端 (仅参考)
- `animation_back.py` - 旧版后端脚本 (保留)

## 环境要求

- 操作系统: Windows 10/11 或 Linux
- Python 3.9-3.11 (后端)
- Node.js 18+ (前端, Vite 6)
- Git (含子模块)
- 可选: NVIDIA GPU + CUDA (模型推理)
- 可选: WSL2 (需要调用 Linux 环境时)

## 安装与环境搭建

### 1) 拉取代码 + 子模块

```bash
git clone --recurse-submodules <repo_url>
# 如果已 clone:
git submodule update --init --recursive
```

### 2) 后端 Python 环境 (Orchestrator)

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/macOS
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) 前端依赖 (apps/web)

```bash
cd apps/web
npm install
```

### 3.1) 前端环境变量 (可选)

- `VITE_DEV_PROXY_TARGET`: 开发代理后端地址, 默认 `http://localhost:8000`
- `VITE_API_BASE`: API Base, 为空表示同源
- `VITE_USE_MOCK`: 设为 `1` 启用 Mock 资源与事件
- `VITE_BASE`: 部署时的 base path (可选)

可将 `apps/web/.env.example` 复制为 `.env.local` 进行配置。

### 4) 第三方模型与工具 (完整流程必需)

- AnimationGPT (motion): `third_party/AnimationGPT`
  - 需要 `third_party/AnimationGPT/algorithm/MotionGPT/mGPT.ckpt`
  - 依赖请按上游 README 安装, 例如:
    `pip install -r third_party/AnimationGPT/algorithm/MotionGPT/requirements.txt`
- Diffusion360 (scene): `third_party/SD-T2I-360PanoImage`
  - `models/` 下需 `sd-base/`, `sr-base/`, `sr-control/`, `RealESRGAN_x2plus.pth`
  - 权重与依赖按上游 README 配置
- MusicGPT (music):
  - Windows 默认使用根目录 `musicgpt-x86_64-pc-windows-msvc.exe`
  - 也可安装系统版并设置 `MUSICGPT_BIN`
- FFMPEG (export):
  - 安装 ffmpeg 并设置 `FFMPEG_BIN` (或 WSL 下 `FFMPEG_BIN_WSL`)

### 5) 关键环境变量

| 变量 | 说明 | 何时需要 |
| --- | --- | --- |
| `ORCH_RUNTIME_DIR` | 运行时目录 | 可选, 默认 `runtime` |
| `ANIMATIONGPT_PYTHON` | AnimationGPT Python 路径 | motion |
| `ANIMATIONGPT_ROOT` | AnimationGPT 根目录 | motion/export |
| `MOTIONGPT_ROOT` | MotionGPT 目录 | motion |
| `DIFFUSION360_PYTHON` | Diffusion360 Python 路径 | scene |
| `DIFFUSION360_ROOT` | Diffusion360 根目录 | scene |
| `DIFFUSION360_DEVICE` | `cuda`/`cuda:0`/`cpu` | scene |
| `MUSICGPT_BIN` | MusicGPT 可执行文件 | music |
| `PYTHON_MP4_EXE` | animation.py 使用的 Python | export |
| `ANIMATION_PY` | animation.py 路径 | export |
| `FFMPEG_BIN` | ffmpeg 可执行文件 | export |
| `FFMPEG_BIN_WSL` | WSL 下 ffmpeg | export + WSL |
| `WSL_DISTRO` | WSL 发行版 | 使用 WSL 时 |

PowerShell 示例:

```powershell
$env:ORCH_RUNTIME_DIR = "runtime"
$env:ANIMATIONGPT_PYTHON = "C:\path\to\python.exe"
$env:DIFFUSION360_PYTHON = "C:\path\to\python.exe"
$env:FFMPEG_BIN = "C:\path\to\ffmpeg.exe"
$env:MUSICGPT_BIN = "E:\path\to\musicgpt.exe"
$env:WSL_DISTRO = "Ubuntu"
```

Bash 示例:

```bash
export ORCH_RUNTIME_DIR=runtime
export ANIMATIONGPT_PYTHON=/path/to/python
export DIFFUSION360_PYTHON=/path/to/python
export FFMPEG_BIN=/usr/bin/ffmpeg
export MUSICGPT_BIN=/path/to/musicgpt
export WSL_DISTRO=Ubuntu
```

### 6) 启动服务

后端 (Windows 推荐):

```powershell
.\start_orchestrator.ps1 -Port 8000 -RuntimeDir runtime
```

说明: `start_orchestrator.ps1` 内包含示例路径, 请按本机环境修改。

后端 (通用):

```bash
python -m uvicorn services.orchestrator.src.main:app --reload --port 8000
```

前端:

```bash
cd apps/web
npm run dev
```

浏览器访问: `http://localhost:5173`

### 7) 快速验证 (API)

```bash
curl -X POST "http://localhost:8000/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"A warrior dashes forward\",\"options\":{\"targets\":[\"motion\",\"music\"],\"duration_s\":8}}"
```

### 8) 前端 Mock 模式

无需后端或模型:

```bash
cd apps/web
VITE_USE_MOCK=1 npm run dev
```

可将 `apps/web/.env.example` 复制为 `.env.local` 调整 `VITE_DEV_PROXY_TARGET` 等配置。

## 文档

- `docs/api.md` - API 约定
- `docs/uir_schema.md` - UIR v1 schema
- `services/orchestrator/README.md` - 后端本地 smoke test
- `apps/web/README.md` - 前端说明

## 常见问题

- `E_DEPENDENCY_MISSING`: 检查模型权重、可执行文件、环境变量是否配置
- `DIFFUSION360_PYTHON not configured`: 需设置 `DIFFUSION360_PYTHON`
- `ffmpeg executable not found`: 安装 ffmpeg 并设置 `FFMPEG_BIN`
- WSL 路径报错: 设置 `WSL_DISTRO` 或改用 Windows 路径
