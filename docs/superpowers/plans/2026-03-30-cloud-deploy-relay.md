# Cloud Deployment + Local Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Animind as a cloud control plane on Alibaba Cloud ECS while offloading motion, scene, and music generation to a local Relay service that runs on the user's GPU machine.

**Architecture:** Keep the browser contract unchanged: the frontend, API, WebSocket, and assets remain same-origin under `https://animind.top`. Add a remote-execution layer inside Orchestrator, build a new Relay service for local execution and upload, persist job state on the cloud node, and commit deployment templates so ECS and Relay hosts can be provisioned repeatably.

**Tech Stack:** FastAPI, Uvicorn, Python 3.10, SQLite, httpx, React + Vite, Nginx, systemd, Alibaba Cloud ECS + EIP + DNS, local GPU model environments, existing AnimationGPT / Diffusion360 / MusicGPT adapters.

---

## File Structure

### Orchestrator Execution Profile and Relay Integration

- Create: `services/orchestrator/src/config/providers.py`
- Create: `services/orchestrator/src/config/relay.py`
- Create: `services/orchestrator/src/storage/jobs_db.py`
- Create: `services/orchestrator/src/api/relay.py`
- Create: `services/orchestrator/src/adapters/relay_client.py`
- Create: `services/orchestrator/src/adapters/remote_motion.py`
- Create: `services/orchestrator/src/adapters/remote_scene.py`
- Create: `services/orchestrator/src/adapters/remote_music.py`
- Modify: `services/orchestrator/src/uir/builder.py`
- Modify: `services/orchestrator/src/scheduler/worker.py`
- Modify: `services/orchestrator/src/scheduler/store.py`
- Modify: `services/orchestrator/src/adapters/registry.py`
- Modify: `services/orchestrator/src/api/router.py`
- Modify: `services/orchestrator/src/main.py`

### Relay Service

- Create: `services/relay/src/main.py`
- Create: `services/relay/src/api/tasks.py`
- Create: `services/relay/src/config/settings.py`
- Create: `services/relay/src/config/runtime.py`
- Create: `services/relay/src/queue/store.py`
- Create: `services/relay/src/queue/worker.py`
- Create: `services/relay/src/executors/dispatch.py`
- Create: `services/relay/src/upload/orchestrator.py`
- Create: `services/relay/README.md`

### Tests and Deployment Assets

- Create: `tests/test_provider_config.py`
- Create: `tests/test_relay_upload_api.py`
- Create: `tests/test_job_store_persistence.py`
- Create: `tests/test_remote_adapters.py`
- Create: `tests/test_relay_task_api.py`
- Create: `tests/test_relay_worker.py`
- Create: `tests/test_deployment_templates.py`
- Create: `deploy/nginx/animind.conf.example`
- Create: `deploy/systemd/animind-orchestrator.service`
- Create: `deploy/systemd/animind-relay.service`
- Create: `deploy/env/animind.orchestrator.env.example`
- Create: `deploy/env/animind.relay.env.example`
- Create: `deploy/scripts/deploy-orchestrator.sh`
- Create: `deploy/scripts/deploy-relay.sh`
- Create: `docs/deployment/cloud-relay-runbook.md`
- Create: `apps/web/.env.production.example`
- Create: `tools/smoke/smoke_cloud_job.py`
- Create: `tools/smoke/smoke_relay_task.py`
- Modify: `README.md`

## Task 1: Add a Configurable Execution Profile

**Files:**
- Create: `services/orchestrator/src/config/providers.py`
- Create: `tests/test_provider_config.py`
- Modify: `services/orchestrator/src/uir/builder.py`
- Modify: `services/orchestrator/src/scheduler/worker.py`

- [ ] **Step 1: Write the failing tests for local vs relay provider selection**

```python
import os
import unittest
from unittest.mock import patch

from services.orchestrator.src.config.providers import get_provider_profile
from services.orchestrator.src.uir.builder import build_uir_from_prompt


class TestProviderConfig(unittest.TestCase):
    def test_local_mode_keeps_existing_local_providers(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "local"}, clear=False):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_local")
            self.assertEqual(profile.scene, "diffusion360_local")
            self.assertEqual(profile.music, "musicgpt_cli")

    def test_relay_mode_switches_motion_scene_music(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "relay"}, clear=False):
            profile = get_provider_profile()
            self.assertEqual(profile.motion, "animationgpt_relay")
            self.assertEqual(profile.scene, "diffusion360_relay")
            self.assertEqual(profile.music, "musicgpt_relay")

    def test_build_uir_uses_current_profile(self):
        with patch.dict(os.environ, {"ORCH_EXECUTION_MODE": "relay"}, clear=False):
            uir = build_uir_from_prompt("sunset warrior", {"targets": ["motion", "scene", "music"]})
            self.assertEqual(uir["routing"]["motion"]["provider"], "animationgpt_relay")
            self.assertEqual(uir["routing"]["scene"]["provider"], "diffusion360_relay")
            self.assertEqual(uir["routing"]["music"]["provider"], "musicgpt_relay")
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `conda run -n animind python -m unittest tests.test_provider_config -v`

Expected: FAIL because `config.providers` does not exist and `uir.builder` still hard-codes local providers.

- [ ] **Step 3: Implement the provider profile abstraction**

```python
# services/orchestrator/src/config/providers.py
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderProfile:
    scene: str
    motion: str
    music: str
    character: str
    preview: str
    export: str


_LOCAL = ProviderProfile("diffusion360_local", "animationgpt_local", "musicgpt_cli", "builtin_library", "web_threejs", "ffmpeg_export")
_RELAY = ProviderProfile("diffusion360_relay", "animationgpt_relay", "musicgpt_relay", "builtin_library", "web_threejs", "ffmpeg_export")


def get_provider_profile() -> ProviderProfile:
    mode = os.getenv("ORCH_EXECUTION_MODE", "local").strip().lower()
    base = _RELAY if mode == "relay" else _LOCAL
    return ProviderProfile(
        scene=os.getenv("ORCH_PROVIDER_SCENE", base.scene).strip(),
        motion=os.getenv("ORCH_PROVIDER_MOTION", base.motion).strip(),
        music=os.getenv("ORCH_PROVIDER_MUSIC", base.music).strip(),
        character=os.getenv("ORCH_PROVIDER_CHARACTER", base.character).strip(),
        preview=os.getenv("ORCH_PROVIDER_PREVIEW", base.preview).strip(),
        export=os.getenv("ORCH_PROVIDER_EXPORT", base.export).strip(),
    )


def get_default_provider(modality: str) -> str | None:
    profile = get_provider_profile()
    return getattr(profile, modality, None)
```

```python
# services/orchestrator/src/uir/builder.py
from ..config.providers import get_default_provider
```

```python
def _build_routing(options: Dict[str, Any], targets: List[str]) -> Dict[str, Any]:
    overrides = options.get("routing")
    overrides = overrides if isinstance(overrides, dict) else {}
    routing: Dict[str, Any] = {}
    for name in targets:
        provider = _provider_override(overrides.get(name)) or get_default_provider(name)
        if provider:
            routing[name] = {"provider": provider}
    return routing
```

```python
# services/orchestrator/src/scheduler/worker.py
from ..config.providers import get_default_provider
```

```python
def _resolve_provider_id(uir: Dict[str, Any], modality: str) -> Optional[str]:
    routing = uir.get("routing")
    if isinstance(routing, dict):
        entry = routing.get(modality)
        if isinstance(entry, dict):
            provider = entry.get("provider")
            if isinstance(provider, str) and provider.strip():
                return provider.strip()
    return get_default_provider(modality)
```

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `conda run -n animind python -m unittest tests.test_provider_config -v`

Expected: PASS with all three tests green.

- [ ] **Step 5: Commit the execution-profile change**

```bash
git add services/orchestrator/src/config/providers.py services/orchestrator/src/uir/builder.py services/orchestrator/src/scheduler/worker.py tests/test_provider_config.py
git commit -m "feat: add configurable execution profiles"
```

## Task 2: Add Relay Upload Ingestion and Persist Job Metadata

**Files:**
- Create: `services/orchestrator/src/config/relay.py`
- Create: `services/orchestrator/src/storage/jobs_db.py`
- Create: `services/orchestrator/src/api/relay.py`
- Create: `tests/test_relay_upload_api.py`
- Create: `tests/test_job_store_persistence.py`
- Modify: `services/orchestrator/src/scheduler/store.py`
- Modify: `services/orchestrator/src/api/router.py`
- Modify: `services/orchestrator/src/main.py`

- [ ] **Step 1: Write the failing tests for relay uploads and restart persistence**

```python
import io
import json
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from services.orchestrator.src.main import create_app
from services.orchestrator.src.scheduler.store import JobStore


class TestRelayUploadApi(unittest.TestCase):
    def test_relay_upload_writes_cloud_asset(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            os.environ["ORCH_RUNTIME_DIR"] = temp_dir
            os.environ["RELAY_SHARED_TOKEN"] = "test-token"
            app = create_app()
            client = TestClient(app)
            store = JobStore()
            job = store.create_job({"uir_version": "1.0", "job": {"id": "job_relay"}})

            response = client.post(
                f"/api/jobs/{job.job_id}/relay-upload",
                data={"manifest": json.dumps([{"role": "music_wav", "relative_path": "music/music.wav", "mime": "audio/wav"}])},
                files={"files": ("music.wav", io.BytesIO(b"wav"), "audio/wav")},
                headers={"X-Relay-Token": "test-token"},
            )

            self.assertEqual(response.status_code, 200)
            self.assertTrue(Path(temp_dir, "assets", job.job_id, "music", "music.wav").is_file())
```

```python
import os
import tempfile
import unittest

from services.orchestrator.src.scheduler.store import JobStore


class TestJobStorePersistence(unittest.TestCase):
    def test_jobs_restore_after_store_recreation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            os.environ["ORCH_RUNTIME_DIR"] = temp_dir
            store_a = JobStore()
            job = store_a.create_job({"uir_version": "1.0", "job": {"id": "job_disk"}})
            store_a.update_job(job.job_id, status="FAILED", message="relay disconnected")

            store_b = JobStore()
            restored = store_b.get_job(job.job_id)

            self.assertIsNotNone(restored)
            self.assertEqual(restored.status.value, "FAILED")
            self.assertEqual(restored.message, "relay disconnected")
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `conda run -n animind python -m unittest tests.test_relay_upload_api tests.test_job_store_persistence -v`

Expected: FAIL because the upload API and persistent store do not exist.

- [ ] **Step 3: Implement relay settings, upload ingestion, and SQLite-backed snapshots**

```python
# services/orchestrator/src/config/relay.py
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RelaySettings:
    base_url: str
    token: str
    timeout_s: float
    verify_tls: bool


def get_relay_settings() -> RelaySettings:
    return RelaySettings(
        base_url=os.getenv("RELAY_BASE_URL", "").strip().rstrip("/"),
        token=os.getenv("RELAY_SHARED_TOKEN", "").strip(),
        timeout_s=float(os.getenv("RELAY_TIMEOUT_S", "30")),
        verify_tls=os.getenv("RELAY_VERIFY_TLS", "1").strip() != "0",
    )
```

```python
# services/orchestrator/src/storage/jobs_db.py
from __future__ import annotations

import json
import sqlite3
from pathlib import Path


def init_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("create table if not exists jobs (job_id text primary key, payload text not null)")
        conn.commit()
    finally:
        conn.close()


def upsert_job(db_path: Path, job_id: str, payload: dict) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "insert into jobs(job_id, payload) values (?, ?) on conflict(job_id) do update set payload=excluded.payload",
            (job_id, json.dumps(payload, ensure_ascii=True)),
        )
        conn.commit()
    finally:
        conn.close()
```

```python
# services/orchestrator/src/api/relay.py
from __future__ import annotations

import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from ..config.relay import get_relay_settings
from ..config.runtime import get_runtime_paths
from ..storage.manifest import make_asset_url

router = APIRouter()


@router.post("/jobs/{job_id}/relay-upload")
async def relay_upload(
    job_id: str,
    manifest: str = Form(...),
    files: List[UploadFile] = File(...),
    x_relay_token: str | None = Header(default=None),
):
    settings = get_relay_settings()
    if not settings.token or x_relay_token != settings.token:
        raise HTTPException(status_code=403, detail="invalid relay token")

    entries = json.loads(manifest)
    runtime = get_runtime_paths()
    job_root = runtime.assets_dir / job_id
    artifacts = []

    for index, entry in enumerate(entries):
        relative_path = Path(entry["relative_path"])
        target = (job_root / relative_path).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        data = await files[index].read()
        target.write_bytes(data)
        artifacts.append(
            {
                "role": entry["role"],
                "uri": make_asset_url(job_id, relative_path.as_posix()),
                "mime": entry.get("mime"),
                "bytes": len(data),
            }
        )
    return {"job_id": job_id, "artifacts": artifacts}
```

```python
# services/orchestrator/src/scheduler/store.py
from ..storage.jobs_db import init_db, upsert_job

class JobStore:
    def __init__(self, max_log_lines: int = 200) -> None:
        self._jobs = {}
        self._lock = threading.Lock()
        self._max_log_lines = max_log_lines
        runtime_paths = get_runtime_paths()
        self._db_path = runtime_paths.runtime_dir / "jobs.db"
        init_db(self._db_path)

    def _persist(self, job: Job) -> None:
        payload = {
            "job_id": job.job_id,
            "status": job.status.value,
            "stage": job.stage,
            "progress": job.progress,
            "message": job.message,
            "uir": job.uir,
            "manifest_path": job.manifest_path,
            "manifest_url": job.manifest_url,
        }
        upsert_job(self._db_path, job.job_id, payload)
```

- [ ] **Step 4: Re-run the focused tests and confirm they pass**

Run: `conda run -n animind python -m unittest tests.test_relay_upload_api tests.test_job_store_persistence -v`

Expected: PASS with upload ingestion and restart persistence verified.

- [ ] **Step 5: Commit the cloud-side relay ingestion layer**

```bash
git add services/orchestrator/src/config/relay.py services/orchestrator/src/storage/jobs_db.py services/orchestrator/src/api/relay.py services/orchestrator/src/scheduler/store.py services/orchestrator/src/api/router.py services/orchestrator/src/main.py tests/test_relay_upload_api.py tests/test_job_store_persistence.py
git commit -m "feat: add relay upload ingestion and persisted jobs"
```

## Task 3: Add Remote Motion, Scene, and Music Adapters

**Files:**
- Create: `services/orchestrator/src/adapters/relay_client.py`
- Create: `services/orchestrator/src/adapters/remote_motion.py`
- Create: `services/orchestrator/src/adapters/remote_scene.py`
- Create: `services/orchestrator/src/adapters/remote_music.py`
- Create: `tests/test_remote_adapters.py`
- Modify: `services/orchestrator/src/adapters/registry.py`

- [ ] **Step 1: Write the failing tests for remote-task submission and polling**

```python
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from services.orchestrator.src.adapters.remote_motion import RemoteMotionAdapter


class Reporter:
    cancel_token = None

    def __init__(self):
        self.events = []

    def stage(self, name, progress, message="", extra=None):
        self.events.append((name, progress, message))

    def log(self, line):
        self.events.append(("log", 0.0, line))

    def is_canceled(self):
        return False


class TestRemoteAdapters(unittest.TestCase):
    @patch("services.orchestrator.src.adapters.remote_motion.RelayClient")
    def test_remote_motion_adapter_returns_cloud_asset_refs(self, client_cls):
        client = Mock()
        client.create_task.return_value = {"task_id": "task_1", "status": "queued"}
        client.get_task.side_effect = [
            {"task_id": "task_1", "status": "running", "progress": 0.4},
            {
                "task_id": "task_1",
                "status": "succeeded",
                "progress": 1.0,
                "artifacts": [{"role": "motion_bvh", "relative_path": "motion/motion.bvh", "mime": "text/plain", "bytes": 128}],
            },
        ]
        client_cls.return_value = client

        adapter = RemoteMotionAdapter()
        result = adapter.run(
            {"job": {"id": "job_remote"}, "modules": {"motion": {"enabled": True, "prompt": "walk", "fps": 30}}},
            Path("runtime/assets/job_remote"),
            Reporter(),
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["artifacts"][0]["uri"], "/assets/job_remote/motion/motion.bvh")
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `conda run -n animind python -m unittest tests.test_remote_adapters -v`

Expected: FAIL because the relay client and remote adapters do not exist.

- [ ] **Step 3: Implement the relay HTTP client and modality-specific remote adapters**

```python
# services/orchestrator/src/adapters/relay_client.py
from __future__ import annotations

import httpx

from ..config.relay import get_relay_settings


class RelayClient:
    def __init__(self) -> None:
        self._settings = get_relay_settings()

    def _headers(self) -> dict[str, str]:
        return {"X-Relay-Token": self._settings.token}

    def create_task(self, payload: dict) -> dict:
        with httpx.Client(timeout=self._settings.timeout_s, verify=self._settings.verify_tls) as client:
            response = client.post(f"{self._settings.base_url}/v1/tasks", json=payload, headers=self._headers())
            response.raise_for_status()
            return response.json()

    def get_task(self, task_id: str) -> dict:
        with httpx.Client(timeout=self._settings.timeout_s, verify=self._settings.verify_tls) as client:
            response = client.get(f"{self._settings.base_url}/v1/tasks/{task_id}", headers=self._headers())
            response.raise_for_status()
            return response.json()
```

```python
# services/orchestrator/src/adapters/remote_motion.py
from __future__ import annotations

import time
from pathlib import Path

from .base import BaseAdapter, build_error
from .relay_client import RelayClient
from ..storage.manifest import make_asset_url


class RemoteMotionAdapter(BaseAdapter):
    provider_id = "animationgpt_relay"
    modality = "motion"
    max_concurrency = 1

    def run(self, uir: dict, out_dir: Path, reporter):
        job_id = str(uir["job"]["id"])
        motion = uir.get("modules", {}).get("motion", {})
        client = RelayClient()
        created = client.create_task(
            {
                "job_id": job_id,
                "kind": "motion",
                "input": {"prompt": motion.get("prompt", "")},
                "options": {"fps": motion.get("fps", 30), "duration_s": motion.get("duration_s")},
            }
        )
        task_id = created["task_id"]
        while True:
            state = client.get_task(task_id)
            reporter.stage(state.get("status", "running"), state.get("progress", 0.0), "relay motion")
            if state.get("status") == "failed":
                return {"ok": False, "provider": self.provider_id, "artifacts": [], "meta": {}, "warnings": [], "error": build_error("E_MODEL_RUNTIME", "relay motion failed", detail=state, retryable=True)}
            if state.get("status") == "succeeded":
                artifacts = []
                for item in state.get("artifacts", []):
                    artifacts.append({"id": f"{job_id}:{item['role']}", "role": item["role"], "uri": make_asset_url(job_id, item["relative_path"]), "mime": item.get("mime"), "bytes": item.get("bytes")})
                return {"ok": True, "provider": self.provider_id, "artifacts": artifacts, "meta": {"task_id": task_id}, "warnings": [], "error": None}
            time.sleep(1.0)
```

- [ ] **Step 4: Register the remote adapters and rerun the tests**

```python
# services/orchestrator/src/adapters/registry.py
from .remote_motion import RemoteMotionAdapter
from .remote_scene import RemoteSceneAdapter
from .remote_music import RemoteMusicAdapter

def _register_defaults() -> None:
    register_adapter(DummyAdapter())
    register_adapter(AnimationGPTAdapter())
    register_adapter(RemoteMotionAdapter())
    register_adapter(BuiltinCharacterSelector())
    register_adapter(PreviewConfigBuilder())
    register_adapter(MusicGPTCliAdapter())
    register_adapter(RemoteMusicAdapter())
    register_adapter(Diffusion360Adapter())
    register_adapter(RemoteSceneAdapter())
    register_adapter(FfmpegExportAdapter())
    register_adapter(DummySceneAdapter())
    register_adapter(DummyMusicAdapter())
```

Run: `conda run -n animind python -m unittest tests.test_remote_adapters -v`

Expected: PASS with remote polling and asset URI synthesis verified.

- [ ] **Step 5: Commit the remote adapters**

```bash
git add services/orchestrator/src/adapters/relay_client.py services/orchestrator/src/adapters/remote_motion.py services/orchestrator/src/adapters/remote_scene.py services/orchestrator/src/adapters/remote_music.py services/orchestrator/src/adapters/registry.py tests/test_remote_adapters.py
git commit -m "feat: add relay-backed remote adapters"
```

## Task 4: Build the Local Relay Service

**Files:**
- Create: `services/relay/src/main.py`
- Create: `services/relay/src/api/tasks.py`
- Create: `services/relay/src/config/settings.py`
- Create: `services/relay/src/config/runtime.py`
- Create: `services/relay/src/queue/store.py`
- Create: `services/relay/src/queue/worker.py`
- Create: `services/relay/src/executors/dispatch.py`
- Create: `services/relay/src/upload/orchestrator.py`
- Create: `services/relay/README.md`
- Create: `tests/test_relay_task_api.py`
- Create: `tests/test_relay_worker.py`

- [ ] **Step 1: Write the failing tests for task creation and upload-driven completion**

```python
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.relay.src.main import create_app


class TestRelayTaskApi(unittest.TestCase):
    def test_post_task_returns_queued_record(self):
        app = create_app()
        client = TestClient(app)
        response = client.post(
            "/v1/tasks",
            json={"job_id": "job_123", "kind": "music", "input": {"prompt": "ambient"}, "options": {"duration_s": 8}},
            headers={"X-Relay-Token": "relay-token"},
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "queued")
```

```python
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services.relay.src.queue.worker import run_single_task


class TestRelayWorker(unittest.TestCase):
    @patch("services.relay.src.upload.orchestrator.upload_artifacts")
    @patch("services.relay.src.executors.dispatch.run_executor")
    def test_worker_marks_task_succeeded_after_upload(self, run_executor, upload_artifacts):
        run_executor.return_value = [{"role": "music_wav", "relative_path": "music/music.wav", "mime": "audio/wav"}]
        upload_artifacts.return_value = {"artifacts": [{"role": "music_wav", "relative_path": "music/music.wav"}]}

        with tempfile.TemporaryDirectory() as temp_dir:
            task = {"task_id": "task_1", "job_id": "job_123", "kind": "music", "status": "queued", "input": {"prompt": "ambient"}, "options": {"duration_s": 8}}
            result = run_single_task(task, Path(temp_dir))
            self.assertEqual(result["status"], "succeeded")
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `conda run -n animind python -m unittest tests.test_relay_task_api tests.test_relay_worker -v`

Expected: FAIL because the Relay package and worker do not exist.

- [ ] **Step 3: Implement the Relay API, queue, executor dispatch, and uploader**

```python
# services/relay/src/config/settings.py
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
```

```python
# services/relay/src/api/tasks.py
from fastapi import APIRouter, Header, HTTPException

from ..config.settings import get_settings
from ..queue.store import create_task_record, get_task_record

router = APIRouter()


def _assert_token(value: str | None) -> None:
    if value != get_settings().token:
        raise HTTPException(status_code=403, detail="invalid relay token")


@router.post("/tasks", status_code=202)
def create_task(payload: dict, x_relay_token: str | None = Header(default=None)):
    _assert_token(x_relay_token)
    return create_task_record(payload)


@router.get("/tasks/{task_id}")
def get_task(task_id: str, x_relay_token: str | None = Header(default=None)):
    _assert_token(x_relay_token)
    record = get_task_record(task_id)
    if record is None:
        raise HTTPException(status_code=404, detail="task not found")
    return record
```

```python
# services/relay/src/executors/dispatch.py
from services.orchestrator.src.adapters.animationgpt import AnimationGPTAdapter
from services.orchestrator.src.adapters.diffusion360 import Diffusion360Adapter
from services.orchestrator.src.adapters.musicgpt_cli import MusicGPTCliAdapter
```

```python
def run_executor(task: dict, task_root: Path):
    kind = task["kind"]
    if kind == "motion":
        adapter = AnimationGPTAdapter()
    elif kind == "scene":
        adapter = Diffusion360Adapter()
    elif kind == "music":
        adapter = MusicGPTCliAdapter()
    else:
        raise ValueError(f"unsupported relay kind: {kind}")
    ...
```

```python
# services/relay/src/upload/orchestrator.py
import json
import httpx

from ..config.settings import get_settings


def upload_artifacts(job_id: str, artifacts: list[dict], task_root: Path) -> dict:
    settings = get_settings()
    manifest = [{"role": item["role"], "relative_path": item["relative_path"], "mime": item.get("mime")} for item in artifacts]
    files = [("files", ((task_root / item["relative_path"]).name, (task_root / item["relative_path"]).read_bytes(), item.get("mime") or "application/octet-stream")) for item in artifacts]
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{settings.orchestrator_base_url}/api/jobs/{job_id}/relay-upload",
            data={"manifest": json.dumps(manifest, ensure_ascii=True)},
            files=files,
            headers={"X-Relay-Token": settings.orchestrator_token},
        )
        response.raise_for_status()
        return response.json()
```

```python
# services/relay/src/main.py
from fastapi import FastAPI

from .api.tasks import router as tasks_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(tasks_router, prefix="/v1")
    return app


app = create_app()
```

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `conda run -n animind python -m unittest tests.test_relay_task_api tests.test_relay_worker -v`

Expected: PASS with queued task creation and upload-driven completion.

- [ ] **Step 5: Commit the Relay service**

```bash
git add services/relay/src/main.py services/relay/src/api/tasks.py services/relay/src/config/settings.py services/relay/src/config/runtime.py services/relay/src/queue/store.py services/relay/src/queue/worker.py services/relay/src/executors/dispatch.py services/relay/src/upload/orchestrator.py services/relay/README.md tests/test_relay_task_api.py tests/test_relay_worker.py
git commit -m "feat: add local relay service"
```

## Task 5: Add Deployment Templates and Final Verification

**Files:**
- Create: `deploy/nginx/animind.conf.example`
- Create: `deploy/systemd/animind-orchestrator.service`
- Create: `deploy/systemd/animind-relay.service`
- Create: `deploy/env/animind.orchestrator.env.example`
- Create: `deploy/env/animind.relay.env.example`
- Create: `deploy/scripts/deploy-orchestrator.sh`
- Create: `deploy/scripts/deploy-relay.sh`
- Create: `docs/deployment/cloud-relay-runbook.md`
- Create: `apps/web/.env.production.example`
- Create: `tools/smoke/smoke_cloud_job.py`
- Create: `tools/smoke/smoke_relay_task.py`
- Create: `tests/test_deployment_templates.py`
- Modify: `README.md`

- [ ] **Step 1: Write the failing template-existence test**

```python
from pathlib import Path
import unittest


class TestDeploymentTemplates(unittest.TestCase):
    def test_required_templates_exist(self):
        required = [
            Path("deploy/nginx/animind.conf.example"),
            Path("deploy/systemd/animind-orchestrator.service"),
            Path("deploy/systemd/animind-relay.service"),
            Path("deploy/env/animind.orchestrator.env.example"),
            Path("deploy/env/animind.relay.env.example"),
            Path("docs/deployment/cloud-relay-runbook.md"),
        ]
        missing = [str(path) for path in required if not path.is_file()]
        self.assertEqual(missing, [])
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `conda run -n animind python -m unittest tests.test_deployment_templates -v`

Expected: FAIL because the deployment assets do not exist yet.

- [ ] **Step 3: Add the ECS, Relay, and smoke-check deployment assets**

```nginx
# deploy/nginx/animind.conf.example
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name animind.top www.animind.top;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name animind.top www.animind.top;
    root /srv/animind/web/dist;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/jobs/ { proxy_buffering off; proxy_pass http://127.0.0.1:8000; }
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 600s;
    }
    location /assets/ { alias /var/lib/animind/runtime/assets/; }
}
```

```ini
# deploy/systemd/animind-orchestrator.service
[Service]
User=animind
WorkingDirectory=/srv/animind/repo
EnvironmentFile=/etc/animind/animind.orchestrator.env
ExecStart=/usr/bin/python3 -m uvicorn services.orchestrator.src.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
```

```env
# deploy/env/animind.orchestrator.env.example
ORCH_EXECUTION_MODE=relay
ORCH_RUNTIME_DIR=/var/lib/animind/runtime
RELAY_BASE_URL=http://100.64.0.10:9001
RELAY_SHARED_TOKEN=change-me
```

```env
# apps/web/.env.production.example
VITE_API_BASE=
VITE_USE_MOCK=0
```

- [ ] **Step 4: Run final verification**

Run:
- `conda run -n animind python -m unittest discover -s tests`
- `npm test`
- `npm run build`

Expected:
- backend tests PASS
- frontend tests PASS
- Vite production build PASS

- [ ] **Step 5: Commit the deployment assets and verification scripts**

```bash
git add deploy/nginx/animind.conf.example deploy/systemd/animind-orchestrator.service deploy/systemd/animind-relay.service deploy/env/animind.orchestrator.env.example deploy/env/animind.relay.env.example deploy/scripts/deploy-orchestrator.sh deploy/scripts/deploy-relay.sh docs/deployment/cloud-relay-runbook.md apps/web/.env.production.example tools/smoke/smoke_cloud_job.py tools/smoke/smoke_relay_task.py tests/test_deployment_templates.py README.md
git commit -m "docs: add cloud relay deployment assets"
```

## Self-Review

### Spec Coverage Check

The plan covers:
1. Same-origin public entry under `animind.top`: Task 5.
2. Relay-backed motion / scene / music execution: Tasks 1, 3, and 4.
3. Cloud-authoritative `/assets`: Tasks 2 and 3.
4. Persistent cloud job metadata: Task 2.
5. Local Relay queue and upload loop: Task 4.
6. Deployment and verification handoff: Task 5.

### Placeholder Scan

The plan avoids `TODO`, `TBD`, and “implement later”. Each task contains:
1. Exact file paths.
2. A focused failing test.
3. A concrete implementation sketch.
4. Exact verification commands.
5. A commit boundary.

### Type Consistency Check

The plan uses these names consistently:
1. `ProviderProfile`
2. `get_provider_profile`
3. `RelaySettings`
4. `RelayClient`
5. `RemoteMotionAdapter`
6. `relay_upload`
7. `JobStore`
8. `upload_artifacts`
