# Relay Service

Local GPU relay service for Animind. It accepts task requests from the cloud orchestrator, runs the existing local model adapters on the relay host, and uploads generated artifacts back to the orchestrator.

## Start the Service

PowerShell:

```powershell
$env:RELAY_SHARED_TOKEN = "replace-with-shared-token"
$env:ORCHESTRATOR_BASE_URL = "https://animind.top"
$env:ORCHESTRATOR_RELAY_TOKEN = $env:RELAY_SHARED_TOKEN
python -m uvicorn services.relay.src.main:app --host 0.0.0.0 --port 9000
```

Bash:

```bash
export RELAY_SHARED_TOKEN=replace-with-shared-token
export ORCHESTRATOR_BASE_URL=https://animind.top
export ORCHESTRATOR_RELAY_TOKEN=$RELAY_SHARED_TOKEN
python -m uvicorn services.relay.src.main:app --host 0.0.0.0 --port 9000
```

## Required Environment Variables

- `RELAY_SHARED_TOKEN`
- `ORCHESTRATOR_BASE_URL`
- `ORCHESTRATOR_RELAY_TOKEN`

Common optional values:

- `RELAY_RUNTIME_DIR`
- `ANIMATIONGPT_PYTHON`
- `DIFFUSION360_PYTHON`
- `MUSICGPT_BIN`
- `FFMPEG_BIN`

See `deploy/env/animind.relay.env.example` for a concrete template.

## API Surface

- `POST /v1/tasks` - queue a relay task
- `GET /v1/tasks/{task_id}` - query task state

The shared token must be sent via `X-Relay-Token`.

## Smoke Check

```bash
python tools/smoke/smoke_relay_task.py --base-url http://127.0.0.1:9000 --token "$RELAY_SHARED_TOKEN"
```

Expected flow:

1. The task is created and returns a `task_id`.
2. The task enters `queued` or `running`.
3. The task reaches `succeeded` or `failed`.

## Related Docs

- `docs/relay_design.md`
- `docs/deployment/cloud-relay-runbook.md`
