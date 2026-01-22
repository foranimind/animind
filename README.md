[English](README_EN.md) | [中文](README.md)

# Animind 数字人动画生成平台

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](<./项目 GitGitHub 协作开发与维护指南.md>)

Animind 是一套面向数字人动画与多模态生成的本地化工作流，涵盖任务编排后端、Web 前端与模型适配器。系统以 UIR（统一中间表示）驱动 scene/motion/music/character/preview/export 等模块，实现从提示词到资产生成、预览与导出的全流程。

## 目录

- [核心能力](#features)
- [目录结构](#structure)
- [环境要求](#requirements)
- [快速开始（仅前端 Mock）](#quickstart-mock)
- [安装与环境搭建（完整流程）](#setup)
- [启动服务](#start)
- [接口速览](#api)
- [Prompt 模式参数（/api/jobs）](#prompt-mode)
- [运行时产物](#runtime)
- [快速验证（API）](#quick-verify)
- [测试](#tests)
- [文档](#docs)
- [贡献](#contributing)
- [许可证](#license)
- [常见问题](#faq)

<a id="features"></a>
## 核心能力

- Orchestrator 编排：任务队列、阶段化状态机、进度与日志、SSE/WS 事件流、manifest 资源清单
- 多模型适配：AnimationGPT（motion）、Diffusion360（scene）、MusicGPT（music）、内置角色库（character）、Three.js 预览配置、ffmpeg 导出
- 本地化运行：Windows/Linux 原生运行；必要时可通过 WSL 调用 Linux 环境模型
- 前端体验：React + Vite + Three.js，支持 Mock 模式与本地预览

<a id="structure"></a>
## 目录结构

- `apps/web` - 新版 Web 前端
- `services/orchestrator` - 后端编排服务
- `docs` - API/UIR/Relay 设计文档
- `tests` - 后端单元测试
- `runtime` - 运行时产物 (assets/cache/logs)
- `third_party` - 第三方模型子模块
- `tools` - 工具与第三方组件
- `apps/web-legacy` - 旧版前端 (仅参考)
- `animation_back.py` - 旧版后端脚本 (保留)

<a id="requirements"></a>
## 环境要求

- 操作系统：Windows 10/11 或 Linux
- Python 3.9-3.11（后端）
- Node.js 18+（前端，Vite 6）
- Git（含子模块）
- 可选：NVIDIA GPU + CUDA（模型推理）
- 可选：WSL2（需要调用 Linux 环境模型时）

<a id="quickstart-mock"></a>
## 快速开始（仅前端 Mock）

无需后端与模型即可浏览 UI：

```bash
cd apps/web
npm install
VITE_USE_MOCK=1 npm run dev
```

浏览器访问：`http://localhost:5173`  
Mock 资源位于 `apps/web/public/mock/assets/demo_job`。

<a id="setup"></a>
## 安装与环境搭建（完整流程）

### 1) 拉取代码与子模块

```bash
git clone --recurse-submodules https://github.com/foranimind/animind.git
# 如果已 clone:
git submodule update --init --recursive
```

### 2) 后端 Python 环境

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/macOS
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) 前端依赖

```bash
cd apps/web
npm install
```

### 4) 第三方模型与工具（完整流程必需）

- AnimationGPT（motion）：`third_party/AnimationGPT`
  - 需准备 `third_party/AnimationGPT/algorithm/MotionGPT/mGPT.ckpt`
  - 依赖请按上游 README 安装：`pip install -r third_party/AnimationGPT/algorithm/MotionGPT/requirements.txt`
- Diffusion360（scene）：`third_party/SD-T2I-360PanoImage`
  - `models/` 下需包含 `sd-base/`、`sr-base/`、`sr-control/`、`RealESRGAN_x2plus.pth`
- MusicGPT（music）：
  - Windows 默认使用根目录 `musicgpt-x86_64-pc-windows-msvc.exe`
  - 也可安装系统版并设置 `MUSICGPT_BIN`
- ffmpeg（export）：
  - 安装 ffmpeg 并设置 `FFMPEG_BIN`（WSL 环境用 `FFMPEG_BIN_WSL`）

### 5) 前端环境变量（apps/web）

- `VITE_DEV_PROXY_TARGET`：开发代理后端地址，默认 `http://localhost:8000`
- `VITE_API_BASE`：API Base，留空表示同源
- `VITE_USE_MOCK`：设为 `1` 启用 Mock 模式
- `VITE_BASE`：部署 base path（可选）

可将 `apps/web/.env.example` 复制为 `.env.local` 配置。

### 6) 后端环境变量（Orchestrator）

| 变量 | 说明 | 默认/备注 |
| --- | --- | --- |
| `ORCH_RUNTIME_DIR` | 运行时目录 | 默认 `runtime` |
| `ANIMATIONGPT_ROOT` | AnimationGPT 根目录 | 默认 `third_party/AnimationGPT` |
| `MOTIONGPT_ROOT` | MotionGPT 目录 | 默认 `third_party/AnimationGPT/algorithm/MotionGPT` |
| `ANIMATIONGPT_PYTHON` | AnimationGPT 运行 Python | 需配置 |
| `DIFFUSION360_ROOT` | Diffusion360 根目录 | 默认 `third_party/SD-T2I-360PanoImage` |
| `DIFFUSION360_PYTHON` | Diffusion360 运行 Python | 需配置 |
| `DIFFUSION360_DEVICE` | `cuda`/`cuda:0`/`cpu` | 可选 |
| `DIFFUSION360_DISABLE_XFORMERS` | 禁用 xformers | 默认 1 |
| `MUSICGPT_BIN` | MusicGPT 可执行文件 | 非默认路径时需配置 |
| `ANIMATION_PY` | `animation.py` 路径 | 默认 `third_party/AnimationGPT/tools/animation.py` |
| `PYTHON_MP4_EXE` | 导出用 Python | 默认跟随 `ANIMATIONGPT_PYTHON` 或系统 Python |
| `FFMPEG_BIN` | ffmpeg 可执行文件 | 需配置 |
| `FFMPEG_BIN_WSL` | WSL 下 ffmpeg | WSL 导出时 |
| `WSL_DISTRO` | WSL 发行版 | 默认 `Ubuntu` |

PowerShell 示例:

```powershell
$env:ORCH_RUNTIME_DIR = "runtime"
$env:ANIMATIONGPT_PYTHON = "C:\path\to\python.exe"
$env:DIFFUSION360_PYTHON = "C:\path\to\python.exe"
$env:DIFFUSION360_DEVICE = "cuda:0"
$env:MUSICGPT_BIN = "E:\path\to\musicgpt.exe"
$env:FFMPEG_BIN = "C:\path\to\ffmpeg.exe"
$env:WSL_DISTRO = "Ubuntu"
```

Bash 示例:

```bash
export ORCH_RUNTIME_DIR=runtime
export ANIMATIONGPT_PYTHON=/path/to/python
export DIFFUSION360_PYTHON=/path/to/python
export DIFFUSION360_DEVICE=cuda:0
export MUSICGPT_BIN=/path/to/musicgpt
export FFMPEG_BIN=/usr/bin/ffmpeg
export WSL_DISTRO=Ubuntu
```

提示：当 `ANIMATIONGPT_PYTHON` 或 `DIFFUSION360_PYTHON` 指向 Linux 路径（如 `/home/...` 或 `\\wsl$\\...`）时，系统会自动通过 WSL 执行。

<a id="start"></a>
## 启动服务

后端（Windows 推荐脚本）：

```powershell
.\start_orchestrator.ps1 -Port 8000 -RuntimeDir runtime
```

说明：`start_orchestrator.ps1` 内含示例路径，请按本机环境修改；`-NoReload` 可关闭热重载。

后端（通用）：

```bash
python -m uvicorn services.orchestrator.src.main:app --reload --port 8000
```

前端：

```bash
cd apps/web
npm run dev
```

浏览器访问：`http://localhost:5173`

<a id="api"></a>
## 接口速览

- `POST /api/jobs`：创建任务（支持 prompt + options 或直接提交 UIR）
- `GET /api/jobs/{job_id}`：查询任务状态与资产信息
- `GET /api/jobs/{job_id}/events`：SSE 事件流
- `WS /ws/jobs/{job_id}`：WebSocket 事件流
- `GET /assets/{job_id}/...`：静态资源（manifest / preview_config / scene / motion / music 等）

详情见：`docs/api.md`、`docs/uir_schema.md`。

<a id="prompt-mode"></a>
## Prompt 模式参数（/api/jobs）

`POST /api/jobs` 在 prompt 模式下接收：

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

常用 `options` 字段说明：

- `targets`：产物类型列表，支持 `scene`、`motion`、`music`、`character`、`preview`、`export`
- `duration_s` / `style` / `mood`：时长与风格信息
- `export_video` / `export_preset`：导出开关与预设（如 `mp4_720p`、`mp4_1080p`、`mp4_4k`、`zip`）
- `advanced.seed` / `advanced.resolution`：场景 seed 与分辨率
- `character_id`：选择内置角色
- `routing`：覆盖模型路由（如 `{"scene":{"provider":"diffusion360_local"}}`）

<a id="runtime"></a>
## 运行时产物

默认输出在 `runtime/assets/<job_id>/`，常见结构：

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
## 快速验证（API）

```bash
curl -X POST "http://localhost:8000/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"A warrior dashes forward\",\"options\":{\"targets\":[\"motion\",\"music\"],\"duration_s\":8}}"
```

<a id="tests"></a>
## 测试

后端：

```bash
python -m unittest discover -s tests
```

前端：

```bash
cd apps/web
npm run test
```

<a id="docs"></a>
## 文档

- `docs/api.md` - API 约定
- `docs/uir_schema.md` - UIR v1 schema
- `docs/relay_design.md` - Relay 设计说明（本地 GPU 中继）
- `services/orchestrator/README.md` - 后端本地 smoke test
- `apps/web/README.md` - 前端说明
- `项目 GitGitHub 协作开发与维护指南.md` - 团队协作与维护规范

<a id="contributing"></a>
## 贡献

欢迎通过 Issue 或 PR 参与贡献。提交前请阅读 `项目 GitGitHub 协作开发与维护指南.md`，确保分支、提交与评审流程一致。

<a id="license"></a>
## 许可证

本项目采用 MIT License，详见 `LICENSE`。`third_party` 目录下组件遵循其各自许可证。

<a id="faq"></a>
## 常见问题

- `E_DEPENDENCY_MISSING`：检查模型权重、可执行文件与环境变量配置
- `DIFFUSION360_PYTHON not configured`：需设置 `DIFFUSION360_PYTHON`
- `musicgpt executable not found`：确认 `MUSICGPT_BIN` 或系统安装路径
- `ffmpeg executable not found`：安装 ffmpeg 并设置 `FFMPEG_BIN`
- WSL 路径报错：确认 WSL 已安装并设置 `WSL_DISTRO`
