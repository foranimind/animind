#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/srv/animind/app
WEB_ROOT=/srv/animind/web

mkdir -p "$APP_ROOT" "$WEB_ROOT"
rsync -a --delete ./ "$APP_ROOT"/

cd "$APP_ROOT/apps/web"
npm ci
npm run build

mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/dist"/

sudo install -m 0644 "$APP_ROOT/deploy/systemd/animind-orchestrator.service" /etc/systemd/system/animind-orchestrator.service
sudo install -m 0644 "$APP_ROOT/deploy/nginx/animind.conf.example" /etc/nginx/conf.d/animind.conf
sudo systemctl daemon-reload
sudo systemctl enable --now animind-orchestrator
sudo nginx -t
sudo systemctl reload nginx
