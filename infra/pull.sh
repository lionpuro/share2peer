#!/usr/bin/env bash

set -euo pipefail

cd /opt/websend/infra
git pull

rm -f .env && touch .env
echo PORT=$PORT >> .env
echo ALLOWED_ORIGINS=$ALLOWED_ORIGINS >> .env

docker compose pull
docker compose up -d --build
