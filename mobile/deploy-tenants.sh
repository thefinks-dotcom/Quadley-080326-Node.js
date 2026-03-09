#!/bin/bash

# ============================================================
# White-Label Multi-Tenant Deployment Script
# ============================================================
# 
# This script builds and optionally submits apps for all tenants
# or specific tenants.
#
# Usage:
#   ./deploy-tenants.sh                    # Build all tenants (both platforms)
#   ./deploy-tenants.sh --submit           # Build and submit all tenants
#   ./deploy-tenants.sh --ios              # Build iOS only for all tenants
#   ./deploy-tenants.sh --android          # Build Android only for all tenants
#   ./deploy-tenants.sh --tenant ormond    # Build specific tenant only
#   ./deploy-tenants.sh --tenant ormond --submit  # Build and submit specific tenant
#
# ============================================================

set -e

# Configuration - Add your tenant build profiles here
TENANTS=(
  "production"              # Main Quadley app
  "production-ormond"       # Ormond College
  "production-murphy-shark" # Murphy Shark
  "production-grace-college" # Grace College
)

# Friendly names for logging
declare -A TENANT_NAMES=(
  ["production"]="Quadley (Main)"
  ["production-ormond"]="Ormond College"
  ["production-murphy-shark"]="Murphy Shark"
  ["production-grace-college"]="Grace College"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
PLATFORM="all"
SUBMIT=false
SPECIFIC_TENANT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --ios)
      PLATFORM="ios"
      shift
      ;;
    --android)
      PLATFORM="android"
      shift
      ;;
    --submit)
      SUBMIT=true
      shift
      ;;
    --tenant)
      SPECIFIC_TENANT="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./deploy-tenants.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --ios              Build iOS only"
      echo "  --android          Build Android only"
      echo "  --submit           Submit to app stores after building"
      echo "  --tenant PROFILE   Build specific tenant only (e.g., production-ormond)"
      echo "  --help             Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Header
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}       White-Label Multi-Tenant Deployment${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Platform: ${YELLOW}$PLATFORM${NC}"
echo -e "Submit to stores: ${YELLOW}$SUBMIT${NC}"
if [ -n "$SPECIFIC_TENANT" ]; then
  echo -e "Specific tenant: ${YELLOW}$SPECIFIC_TENANT${NC}"
fi
echo ""

# Determine which tenants to build
if [ -n "$SPECIFIC_TENANT" ]; then
  TENANTS_TO_BUILD=("$SPECIFIC_TENANT")
else
  TENANTS_TO_BUILD=("${TENANTS[@]}")
fi

# Track results
declare -A BUILD_RESULTS
declare -A SUBMIT_RESULTS

# Build function
build_tenant() {
  local profile=$1
  local name=${TENANT_NAMES[$profile]:-$profile}
  
  echo ""
  echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}Building: ${YELLOW}$name${NC}"
  echo -e "${BLUE}Profile: ${NC}$profile"
  echo -e "${BLUE}Platform: ${NC}$PLATFORM"
  echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
  
  if eas build --platform $PLATFORM --profile $profile --non-interactive; then
    BUILD_RESULTS[$profile]="✅ Success"
    echo -e "${GREEN}✅ Build successful for $name${NC}"
    return 0
  else
    BUILD_RESULTS[$profile]="❌ Failed"
    echo -e "${RED}❌ Build failed for $name${NC}"
    return 1
  fi
}

# Submit function
submit_tenant() {
  local profile=$1
  local name=${TENANT_NAMES[$profile]:-$profile}
  
  echo ""
  echo -e "${BLUE}Submitting: ${YELLOW}$name${NC}"
  
  if eas submit --platform $PLATFORM --profile $profile --latest --non-interactive; then
    SUBMIT_RESULTS[$profile]="✅ Submitted"
    echo -e "${GREEN}✅ Submitted $name to app stores${NC}"
    return 0
  else
    SUBMIT_RESULTS[$profile]="❌ Failed"
    echo -e "${RED}❌ Submit failed for $name${NC}"
    return 1
  fi
}

# Main execution
echo -e "${YELLOW}Starting deployment for ${#TENANTS_TO_BUILD[@]} tenant(s)...${NC}"
echo ""

FAILED_BUILDS=0

for tenant in "${TENANTS_TO_BUILD[@]}"; do
  if ! build_tenant "$tenant"; then
    ((FAILED_BUILDS++))
    continue
  fi
  
  if [ "$SUBMIT" = true ]; then
    submit_tenant "$tenant" || true
  fi
done

# Summary
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}                    DEPLOYMENT SUMMARY${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

echo -e "${YELLOW}Build Results:${NC}"
for tenant in "${TENANTS_TO_BUILD[@]}"; do
  name=${TENANT_NAMES[$tenant]:-$tenant}
  result=${BUILD_RESULTS[$tenant]:-"⏳ Not started"}
  echo -e "  $name: $result"
done

if [ "$SUBMIT" = true ]; then
  echo ""
  echo -e "${YELLOW}Submit Results:${NC}"
  for tenant in "${TENANTS_TO_BUILD[@]}"; do
    name=${TENANT_NAMES[$tenant]:-$tenant}
    result=${SUBMIT_RESULTS[$tenant]:-"⏳ Not submitted"}
    echo -e "  $name: $result"
  done
fi

echo ""
if [ $FAILED_BUILDS -eq 0 ]; then
  echo -e "${GREEN}🎉 All deployments completed successfully!${NC}"
else
  echo -e "${RED}⚠️  $FAILED_BUILDS build(s) failed. Check logs above.${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
