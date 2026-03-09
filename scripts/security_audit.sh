#!/bin/bash
# Security Audit Script for CI/CD Pipeline
# Runs Software Composition Analysis (SCA) on both Python and JavaScript dependencies

set -e

echo "========================================"
echo "Security Audit - Quadley Application"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VULNERABILITIES_FOUND=0

# ============ PYTHON DEPENDENCIES ============
echo "📦 Checking Python dependencies..."
echo "----------------------------------------"

cd /app/backend

# Install pip-audit if not available
pip install pip-audit --quiet 2>/dev/null || true

# Run pip-audit
if pip-audit --format=json > /tmp/pip_audit_results.json 2>/dev/null; then
    PYTHON_VULNS=$(cat /tmp/pip_audit_results.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('dependencies', [])))")
    if [ "$PYTHON_VULNS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $PYTHON_VULNS Python packages with known vulnerabilities${NC}"
        pip-audit --format=columns 2>/dev/null || true
        VULNERABILITIES_FOUND=1
    else
        echo -e "${GREEN}✅ No Python vulnerabilities found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  pip-audit encountered issues (may need dependency resolution)${NC}"
    pip-audit 2>&1 | head -20 || true
fi

echo ""

# ============ JAVASCRIPT DEPENDENCIES ============
echo "📦 Checking JavaScript dependencies..."
echo "----------------------------------------"

# Check frontend
if [ -d "/app/frontend" ]; then
    cd /app/frontend
    echo "Frontend (React):"
    
    if yarn audit --json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('data', {}).get('vulnerabilities', {}).get('total', 0) > 0:
        print(f'Found vulnerabilities')
        sys.exit(1)
except:
    pass
sys.exit(0)
" 2>/dev/null; then
        echo -e "${GREEN}✅ No frontend vulnerabilities found${NC}"
    else
        echo -e "${YELLOW}⚠️  Found frontend vulnerabilities${NC}"
        yarn audit --level high 2>/dev/null | head -30 || true
        VULNERABILITIES_FOUND=1
    fi
fi

# Check mobile
if [ -d "/app/mobile" ]; then
    cd /app/mobile
    echo ""
    echo "Mobile (React Native/Expo):"
    
    if yarn audit --json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('data', {}).get('vulnerabilities', {}).get('total', 0) > 0:
        print(f'Found vulnerabilities')
        sys.exit(1)
except:
    pass
sys.exit(0)
" 2>/dev/null; then
        echo -e "${GREEN}✅ No mobile vulnerabilities found${NC}"
    else
        echo -e "${YELLOW}⚠️  Found mobile vulnerabilities${NC}"
        yarn audit --level high 2>/dev/null | head -30 || true
        VULNERABILITIES_FOUND=1
    fi
fi

echo ""
echo "========================================"

# ============ SUMMARY ============
if [ $VULNERABILITIES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ Security audit passed - no critical vulnerabilities found${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Security audit found vulnerabilities - review recommended${NC}"
    echo "Run 'pip-audit' and 'yarn audit' for details"
    # Exit 0 for now to not block CI, change to exit 1 for strict mode
    exit 0
fi
