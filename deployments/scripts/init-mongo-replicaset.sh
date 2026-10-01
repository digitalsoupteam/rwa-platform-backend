#!/bin/bash
#
# One-shot initializer for the MongoDB replica set `rs0`
# (members: mongodb, mongodb-2, mongodb-3). Run from git-bash / Linux.
# `bun run app:up` performs the same steps via `deployments/scripts/app-up.ts`
# and additionally works from any shell (PowerShell, cmd, ...).
#
# Deliberately NOT part of docker-compose.yml: this step runs over the plain
# Docker CLI, and the helper container is removed right after it exits
# (`docker run --rm`), so no stopped container ever sits in the stack.
#
# Idempotent — safe to run on every deploy:
#   * fresh stack   — starts the three mongodb members and initiates the replica set;
#   * running stack — adds missing members (if any) and exits as soon as the set is READY.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# All docker commands below run from the compose directory: the Docker CLI
# resolves the compose file natively there, and the compose project name stays stable.
cd "$SCRIPT_DIR/../../infrastructure/docker"
if [ ! -f docker-compose.yml ]; then
    echo "❌ docker-compose.yml not found in $(pwd)" >&2
    exit 1
fi

echo "--------------------------------------------------"
echo "🍃 Initializing MongoDB replica set rs0"
echo "--------------------------------------------------"

# 1. The replica set members must be running (no-op when they already are).
docker compose up -d mongodb mongodb-2 mongodb-3

# 2. Detect the network of the running members (works for any compose project name).
MEMBER_ID="$(docker compose ps -q mongodb)"
if [ -z "$MEMBER_ID" ]; then
    echo "❌ The 'mongodb' container is not running" >&2
    exit 1
fi
NETWORK="$(docker inspect "$MEMBER_ID" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' | tr -d '\r' | head -n 1)"
if [ -z "$NETWORK" ]; then
    echo "❌ Could not detect the docker network of the 'mongodb' container" >&2
    exit 1
fi
echo "network: $NETWORK"

# 3. One-shot helper container: creates the set on the first run, adds missing
#    members on later runs, and exits 0 as soon as the set reports READY.
#    The in-container logic lives in init-mongo-container.sh (shared with app-up.ts).
docker run --rm -i --network "$NETWORK" mongo:latest bash -s < "$SCRIPT_DIR/init-mongo-container.sh"

echo "--------------------------------------------------"
echo "✅ MongoDB replica set rs0 is ready"
echo "--------------------------------------------------"
