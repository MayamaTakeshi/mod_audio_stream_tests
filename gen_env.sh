#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

cat > .env <<EOF
USER_NAME=$(whoami)
USER_UID=$(id -u) 
USER_GID=$(id -g)
EOF

cat .env

echo success. .env file created successfully
