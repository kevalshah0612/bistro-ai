#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until node -e "
const net = require('net');
const url = new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://'));
const host = url.hostname;
const port = Number(url.port || 5432);
const socket = net.connect(port, host);
socket.on('connect', () => { socket.end(); process.exit(0); });
socket.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 2000);
" 2>/dev/null; do
  sleep 2
done

echo "Applying database schema..."
npx prisma db push

echo "Seeding menu data..."
npx prisma db seed

echo "Starting API on port ${PORT:-3001}..."
exec node dist/index.js
