#!/usr/bin/env bash

# This is a development helper script to start a docker container
# for initializing a project folder with an interactive shell.
# Usage: ./setup-folder.sh <target-folder-path> [docker-image]
# Example: ./setup-folder.sh ../base-app
#          ./setup-folder.sh ../base-app node:18-alpine

# Show usage if no argument provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <target-folder-path> [docker-image]"
    echo "Examples:"
    echo "  $0 ../base-app            # uses default 'node:latest'"
    echo "  $0 ../base-app node:alpine  # uses Node.js alpine image"
    echo "  $0 ../base-app python:3.11   # uses Python image"
    exit 1
fi

# First parameter is target folder (required)
TARGET_FOLDER="$1"

# Second parameter is docker image (optional, defaults to node:latest)
DOCKER_IMAGE="${2:-node:latest}"

# Ensure target directory exists
mkdir -p "$TARGET_FOLDER"

# Convert to absolute path
TARGET_FOLDER=$(cd "$TARGET_FOLDER" && pwd)

echo "Setting up Node.js environment for: $TARGET_FOLDER"

echo "Using docker image: $DOCKER_IMAGE"

docker run -it --rm \
  --name setup-folder \
  -p 80:80 \
  -v "$TARGET_FOLDER":/usr/src/app \
  -w /usr/src/app \
  $DOCKER_IMAGE bash

echo "Container exited. Check $TARGET_FOLDER for the initialized project."