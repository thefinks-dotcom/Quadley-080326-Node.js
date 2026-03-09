#!/bin/bash
# Quadley Mobile - Clean Build & Run Script
# Usage: TENANT=grace_college ./clean_and_run.sh
# Default tenant: grace_college

set -e

TENANT=${TENANT:-grace_college}

echo "=== Quadley Mobile: Clean Build ==="
echo "Tenant: $TENANT"
echo ""

# Step 1: Pull latest code
echo "[1/5] Pulling latest code..."
git fetch origin && git reset --hard origin/main
echo ""

# Step 2: Install dependencies
echo "[2/5] Installing dependencies..."
cd mobile
npm install
echo ""

# Step 3: Fix Expo compatibility
echo "[3/5] Fixing Expo dependencies..."
npx expo install --fix
echo ""

# Step 4: Clear all caches
echo "[4/5] Clearing caches..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf ios/build
rm -rf android/app/build
echo ""

# Step 5: Start with clean cache
echo "[5/5] Starting Expo with clean cache..."
TENANT=$TENANT npx expo start --clear
