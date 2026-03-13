#!/bin/bash
set -e

echo "Running post-merge setup..."

echo "Installing frontend dependencies..."
cd frontend-next && yarn install --frozen-lockfile 2>/dev/null || yarn install
cd ..

echo "Post-merge setup complete."
