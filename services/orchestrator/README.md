# services/orchestrator

Local smoke-test notes for the orchestrator service.

## Start the Service

PowerShell:

```powershell
$env:ORCH_RUNTIME_DIR = "runtime"
python -m uvicorn services.orchestrator.src.main:app --reload --port 8000
```

Bash:

```bash
export ORCH_RUNTIME_DIR=runtime
python -m uvicorn services.orchestrator.src.main:app --reload --port 8000
```

## Create a Job

Prompt mode works for a lightweight smoke test:

```bash
curl -X POST "http://localhost:8000/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"A warrior dashes forward\",\"options\":{\"targets\":[\"motion\",\"music\"],\"duration_s\":8}}"
```

If you need full routing control, submit a complete UIR payload:

```bash
curl -X POST "http://localhost:8000/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{\"uir_version\":\"1.0\",\"job\":{\"id\":\"job_placeholder\",\"created_at\":\"2025-12-20T00:00:00Z\"},\"input\":{\"raw_prompt\":\"A warrior dashes forward\",\"lang\":\"en\"},\"intent\":{\"targets\":[\"scene\",\"motion\",\"music\",\"preview\"],\"duration_s\":12},\"routing\":{\"scene\":{\"provider\":\"diffusion360_local\"},\"motion\":{\"provider\":\"animationgpt_local\"},\"music\":{\"provider\":\"musicgpt_cli\"},\"preview\":{\"provider\":\"web_threejs\"}},\"modules\":{\"scene\":{\"enabled\":true,\"prompt\":\"A cinematic 360 panorama\",\"resolution\":[2048,1024]},\"motion\":{\"enabled\":true,\"prompt\":\"walk cycle\",\"fps\":30},\"music\":{\"enabled\":true,\"prompt\":\"ambient pad\"},\"character\":{\"enabled\":true,\"character_id\":\"samurai_01\"},\"preview\":{\"enabled\":true,\"camera_preset\":\"orbit\",\"autoplay\":true},\"export\":{\"enabled\":false}}}"
```

The response returns `{ "job_id": "..." }`.

## Stream Events

```bash
curl -N "http://localhost:8000/api/jobs/<job_id>/events"
```

## Verify Outputs

```bash
curl "http://localhost:8000/assets/<job_id>/manifest.json"
curl "http://localhost:8000/assets/<job_id>/preview/preview_config.json"
```

## Notes

- `motion` uses `animationgpt_local`; make sure its dependencies are available.
- `scene` and `music` can use real adapters when Diffusion360 and MusicGPT are configured.
- To export MP4, enable `modules.export.enabled=true`, include `"export"` in `intent.targets`, and set `FFMPEG_BIN` plus `PYTHON_MP4_EXE`.
- If Diffusion360 lives in a separate Python or conda environment, point `DIFFUSION360_PYTHON` at that interpreter.
- Linux-style paths on Windows trigger WSL execution. Set `WSL_DISTRO` when the target distro is not `Ubuntu`.
