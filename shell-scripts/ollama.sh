#!/usr/bin/env bash

# This script installs models for ollama server inside the running ollama container.

CONTAINER_NAME="veribim-kg-ollama-1"

# Check if the container is running
if ! docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Docker container '${CONTAINER_NAME}' is not running."
    echo "Please start the ollama service (e.g., 'docker-compose up -d ollama') and try again."
    exit 1
fi

echo "Pulling models for ollama in container '${CONTAINER_NAME}'..."

docker exec "${CONTAINER_NAME}" ollama pull embeddinggem
docker exec "${CONTAINER_NAME}" ollama pull gemma3:1b

echo "Models pulled successfully."