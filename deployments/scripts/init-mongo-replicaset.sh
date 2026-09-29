#!/bin/bash
#
# One-shot initializer for the MongoDB replica set `rs0`
# (members: mongodb, mongodb-2, mongodb-3).
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

# All docker commands below run from the compose directory: the Docker CLI
# resolves the compose file natively there, and the compose project name stays stable.
cd "$(dirname "${BASH_SOURCE[0]}")/../../infrastructure/docker"
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
docker run --rm -i --network "$NETWORK" mongo:latest bash -s <<'INIT_SCRIPT'
for i in $(seq 1 40); do
  mongosh --host mongodb --quiet --eval '
    try {
      const st = rs.status();
      const want = ["mongodb:27017", "mongodb-2:27017", "mongodb-3:27017"];
      const have = st.members.map(m => m.name);
      for (const w of want) { if (!have.includes(w)) { rs.add(w); print("ADDED " + w); } }
    } catch (e) {
      rs.initiate({ _id: "rs0", members: [
        { _id: 0, host: "mongodb:27017" },
        { _id: 1, host: "mongodb-2:27017" },
        { _id: 2, host: "mongodb-3:27017" }
      ]});
      print("INITIATED");
    }
  ' 2>/dev/null
  out=$(mongosh --host mongodb --quiet --eval '
    try { const s = rs.status(); print(s.ok === 1 && s.members.length >= 3 ? "READY" : "WAIT"); } catch (e) { print("WAIT"); }
  ' 2>/dev/null | tail -1)
  echo "mongo replica set attempt $i: $out"
  if [ "$out" = "READY" ]; then exit 0; fi
  sleep 3
done
exit 1
INIT_SCRIPT

echo "--------------------------------------------------"
echo "✅ MongoDB replica set rs0 is ready"
echo "--------------------------------------------------"
