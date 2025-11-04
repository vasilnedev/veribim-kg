#!/usr/bin/env bash

# This is a development helper script to start a docker container
# just after creating the /doc2kg-backend folder to allow running 'npm init' command
# and install dependencies interactively.

# When the application is established, it shall be started via Docker Compose. 

docker run -it --rm \
  --name veribim-kg-doc2kg-backend-1 \
  -p 80:80 \
  -v ../doc2kg-backend:/usr/src/app \
  -w /usr/src/app \
  node bash