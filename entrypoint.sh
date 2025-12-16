#!/bin/sh
echo "Fixing uploads permissions..."
mkdir -p /usr/src/app/uploads/images
chown -R node:node /usr/src/app/uploads
chmod -R 775 /usr/src/app/uploads
echo "Starting app as node user..."
exec su-exec node "$@"
