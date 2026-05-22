#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/srv/animind/app

rsync -a ./ "$APP_ROOT"/

pip install -r "$APP_ROOT/requirements.txt"

sudo install -m 0644 "$APP_ROOT/deploy/systemd/animind-relay.service" /etc/systemd/system/animind-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now animind-relay
