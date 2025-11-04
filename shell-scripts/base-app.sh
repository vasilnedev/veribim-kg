#!/usr/bin/env bash

# This is a development helper script to start a docker container
# just after creating the /base-app folder to allow running 'npm init' command
# and install dependencies interactively.

# When the application is established, it shall be started via Docker Compose. 

docker run -it --rm \
  --name veribim-kg-node-app-1 \
  -p 80:80 \
  -v ../base-app:/usr/src/app \
  -w /usr/src/app \
  node bash