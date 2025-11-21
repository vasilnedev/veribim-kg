#!/usr/bin/env bash
set -euo pipefail

# install-deps-all.sh
# Run `npm install` in each service folder using a disposable Node Docker image.
# Usage: ./install-deps-all.sh [node-image]
# Example: ./install-deps-all.sh node:20-alpine

IMAGE="${1:-node}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Using Docker image: $IMAGE"
echo "Repo root: $ROOT"

# Base list of known service folders (relative to repo root)
SERVICES=("base-app")

# Auto-discover additional folders that contain package.json
for pkg in "$ROOT"/*/package.json; do
  [ -e "$pkg" ] || continue
  dir=$(dirname "$pkg")
  name=$(basename "$dir")
  # add if not already in SERVICES
  skip=false
  for s in "${SERVICES[@]}"; do
    if [ "$s" = "$name" ]; then skip=true; break; fi
  done
  if [ "$skip" = false ]; then
    SERVICES+=("$name")
  fi
done

echo "Will check these folders: ${SERVICES[*]}"

for svc in "${SERVICES[@]}"; do
  path="$ROOT/$svc"
  if [ -d "$path" ] && [ -f "$path/package.json" ]; then
    echo "=== Installing in $svc (path: $path) ==="
    docker run --rm \
      -v "$path":/usr/src/app \
      -w /usr/src/app \
      -u "$(id -u):$(id -g)" \
      "$IMAGE" \
      bash -lc "npm install"
  else
    echo "Skipping $svc: no package.json found at $path"
  fi
done

echo "All done."
