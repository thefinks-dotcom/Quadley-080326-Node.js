#!/bin/bash
# ============================================================
# Quadley Multi-Tenant Build & Submit Script
# Usage:
#   ./build.sh <tenant> <platform> [submit]
#
# Examples:
#   ./build.sh quadley ios
#   ./build.sh grace_college ios submit
#   ./build.sh quadley android
# ============================================================

set -e

TENANT="${1}"
PLATFORM="${2:-ios}"
ACTION="${3}"

# --- Tenant Config Lookup ---
get_project_id() {
  case "$1" in
    quadley)        echo "02c021f0-c983-449b-ac13-ec787c8ddbe0" ;;
    grace_college)  echo "7c3a9ce2-7717-4878-95b9-b07e614ebaf0" ;;
    *)              echo "" ;;
  esac
}

get_profile() {
  case "$1" in
    quadley)        echo "production-quadley" ;;
    grace_college)  echo "production-grace-college" ;;
    ormond)         echo "production-ormond" ;;
    murphy_shark)   echo "production-murphy-shark" ;;
    *)              echo "" ;;
  esac
}

# --- Validation ---
if [ -z "$TENANT" ]; then
  echo ""
  echo "Usage: ./build.sh <tenant> <platform> [submit]"
  echo ""
  echo "Available tenants:"
  echo "  - quadley"
  echo "  - grace_college"
  echo "  - ormond"
  echo "  - murphy_shark"
  echo ""
  echo "Platforms: ios, android"
  echo ""
  echo "Examples:"
  echo "  ./build.sh quadley ios"
  echo "  ./build.sh grace_college ios submit"
  echo ""
  exit 1
fi

PROFILE=$(get_profile "$TENANT")
PROJECT_ID=$(get_project_id "$TENANT")

if [ -z "$PROFILE" ]; then
  echo "Unknown tenant: $TENANT"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "No EAS project ID configured for tenant: $TENANT"
  echo "Add it to the get_project_id function in this script."
  exit 1
fi

echo ""
echo "============================================"
echo "  Building: $TENANT ($PLATFORM)"
echo "  Profile:  $PROFILE"
echo "  Project:  $PROJECT_ID"
echo "============================================"
echo ""

# --- Step 1: Switch EAS project link ---
echo "[1/3] Switching EAS project to $TENANT..."
rm -rf .expo
mkdir -p .expo
cat > .expo/config.json << EOFCONFIG
{
  "projectId": "$PROJECT_ID"
}
EOFCONFIG
echo "   Linked to project: $PROJECT_ID"

# --- Step 2: Build ---
echo "[2/3] Starting $PLATFORM build..."
export TENANT="$TENANT"

BUILD_OUTPUT=$(eas build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive 2>&1 | tee /dev/tty)

# Extract the artifact URL from build output
ARTIFACT_URL=$(echo "$BUILD_OUTPUT" | grep -oE 'https://expo\.dev/artifacts/eas/[^ ]+\.(ipa|aab|apk)' | tail -1)

if [ -z "$ARTIFACT_URL" ]; then
  echo ""
  echo "Build completed but could not extract artifact URL."
  echo "Check expo.dev for the build status."
  
  if [ "$ACTION" = "submit" ]; then
    echo ""
    echo "To submit manually, find the build URL on expo.dev and run:"
    echo "  TENANT=$TENANT eas submit --platform $PLATFORM --profile $PROFILE --url <BUILD_URL>"
  fi
  exit 0
fi

echo ""
echo "Build artifact: $ARTIFACT_URL"

# --- Step 3: Submit (optional) ---
if [ "$ACTION" = "submit" ]; then
  echo "[3/3] Submitting to App Store / Play Store..."
  eas submit --platform "$PLATFORM" --profile "$PROFILE" --url "$ARTIFACT_URL"
else
  echo ""
  echo "Build complete! To submit, run:"
  echo "  ./build.sh $TENANT $PLATFORM submit"
  echo ""
  echo "Or submit manually:"
  echo "  TENANT=$TENANT eas submit --platform $PLATFORM --profile $PROFILE --url $ARTIFACT_URL"
fi

echo ""
echo "Done!"
