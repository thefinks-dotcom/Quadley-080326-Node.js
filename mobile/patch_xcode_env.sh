#!/bin/bash
# Patches ios/.xcode.env.local to add EXPO_PROJECT_ROOT.
# Run once from the mobile/ directory: bash patch_xcode_env.sh

FILE="ios/.xcode.env.local"

if [ ! -f "$FILE" ]; then
  echo "❌  $FILE not found. Run 'TENANT=grace_college npx expo prebuild --platform ios' first."
  exit 1
fi

if grep -q "EXPO_PROJECT_ROOT" "$FILE"; then
  echo "✅  EXPO_PROJECT_ROOT already present in $FILE — nothing to do."
  exit 0
fi

# Insert the line after the NODE_BINARY export
sed -i '' '/export NODE_BINARY/a\
export EXPO_PROJECT_ROOT="${PROJECT_DIR}/.."
' "$FILE"

echo "✅  Patched $FILE with EXPO_PROJECT_ROOT."
cat "$FILE"
