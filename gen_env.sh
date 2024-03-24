#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

cat > .env <<EOF
USER_NAME=$(whoami)
USER_UID=$(id -u) 
USER_GID=$(id -g)
GIT_USER_NAME=$(git config --global user.name || echo "")
GIT_USER_EMAIL=$(git config --global user.email || echo "") 
EOF

cat .env

echo success. .env file created successfully
