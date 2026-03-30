# Cloud Relay Runbook

## Topology

- ECS hosts the built web frontend, Nginx, and the orchestrator.
- The local machine hosts the relay service and the heavy model adapters.
- Public traffic enters via `https://animind.top`.
- Browser requests stay same-origin: `/api`, `/ws`, `/assets`.

## ECS Preparation

1. Bind an EIP to the ECS instance.
2. Add DNS `A` records for `animind.top` and `www.animind.top`.
3. Open security-group ports `80` and `443`. Restrict `22` to your admin IP.
4. Install `nginx`, `python3`, `nodejs`, and `ffmpeg` as needed.
5. Create a service account:

```bash
sudo useradd --system --home /srv/animind --shell /usr/sbin/nologin animind
sudo mkdir -p /srv/animind /var/lib/animind/runtime /etc/animind
sudo chown -R animind:animind /srv/animind /var/lib/animind
```

## Orchestrator Deployment

1. Copy `deploy/env/animind.orchestrator.env.example` to `/etc/animind/animind.orchestrator.env`.
2. Fill in the shared relay token and runtime paths.
3. Run `deploy/scripts/deploy-orchestrator.sh`.
4. Issue TLS certificates and update the paths in `deploy/nginx/animind.conf.example`.

## Relay Deployment

1. Copy `deploy/env/animind.relay.env.example` to the local relay host.
2. Set `ORCHESTRATOR_BASE_URL=https://animind.top`.
3. Set `ORCHESTRATOR_RELAY_TOKEN` to the same `RELAY_SHARED_TOKEN`.
4. Run `deploy/scripts/deploy-relay.sh`.

## Smoke Checks

Run from the app root after both services are up:

```bash
python tools/smoke/smoke_relay_task.py --base-url http://127.0.0.1:9000 --token "$RELAY_SHARED_TOKEN"
python tools/smoke/smoke_cloud_job.py --base-url https://animind.top
```

Expected results:

- Relay task creation returns `queued`.
- Cloud job creation returns a `job_id`.
- `https://animind.top/assets/...` is reachable through Nginx.

## Rollback

- `sudo systemctl stop animind-orchestrator animind-relay`
- Restore the previous checkout under `/srv/animind/app`
- Restore the previous Nginx config and reload Nginx
- Restart the services
