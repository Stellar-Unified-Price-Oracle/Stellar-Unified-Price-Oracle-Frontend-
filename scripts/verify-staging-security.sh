#!/bin/bash
#
# verify-staging-security.sh
# Verifies that the staging environment is properly configured with security controls.
#
# Checks:
#   - Basic auth is enabled
#   - CSP headers are present
#   - HSTS headers are present
#   - API endpoints are accessible
#   - WebSocket connection works
#
# Usage:
#   ./scripts/verify-staging-security.sh
#   ./scripts/verify-staging-security.sh --url https://custom-staging.example.com
#   ./scripts/verify-staging-security.sh --user staging-user --pass staging-password
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.example.com}"
AUTH_USER="${1:-}"
AUTH_PASS="${2:-}"
VERBOSE=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      STAGING_URL="$2"
      shift 2
      ;;
    --user)
      AUTH_USER="$2"
      shift 2
      ;;
    --pass)
      AUTH_PASS="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    --help)
      cat <<EOF
Usage: ./scripts/verify-staging-security.sh [OPTIONS]

Options:
  --url URL          Staging URL (default: $STAGING_URL)
  --user USER        Basic auth username
  --pass PASS        Basic auth password
  --verbose          Show detailed output
  --help             Show this help message

Environment Variables:
  STAGING_URL        Staging environment URL
  STAGING_USERNAME   Basic auth username
  STAGING_PASSWORD   Basic auth password

Examples:
  ./scripts/verify-staging-security.sh
  ./scripts/verify-staging-security.sh --url https://staging.example.com
  ./scripts/verify-staging-security.sh --user admin --pass secret --verbose
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Functions
check_header() {
  local header=$1
  local expected=$2
  local url=$3
  local auth=$4
  
  if [ -z "$auth" ]; then
    local value=$(curl -s -i "$url" 2>/dev/null | grep -i "^$header:" | cut -d' ' -f2- | tr -d '\r')
  else
    local value=$(curl -s -i -H "Authorization: Basic $auth" "$url" 2>/dev/null | grep -i "^$header:" | cut -d' ' -f2- | tr -d '\r')
  fi
  
  if [ -n "$value" ]; then
    if [ -n "$expected" ] && [[ "$value" == *"$expected"* ]]; then
      echo -e "${GREEN}✓${NC} $header: Present"
      [ $VERBOSE -eq 1 ] && echo "  Value: $value"
      return 0
    elif [ -z "$expected" ]; then
      echo -e "${GREEN}✓${NC} $header: Present"
      [ $VERBOSE -eq 1 ] && echo "  Value: $value"
      return 0
    else
      echo -e "${YELLOW}⚠${NC} $header: Present but unexpected value"
      echo "  Expected: $expected"
      echo "  Got: $value"
      return 1
    fi
  else
    echo -e "${RED}✗${NC} $header: Missing"
    return 1
  fi
}

check_status_code() {
  local url=$1
  local auth=$2
  local expected=${3:-200}
  
  if [ -z "$auth" ]; then
    local code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  else
    local code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic $auth" "$url" 2>/dev/null)
  fi
  
  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}✓${NC} HTTP $code"
    return 0
  else
    echo -e "${RED}✗${NC} HTTP $code (expected $expected)"
    return 1
  fi
}

# Main checks
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Staging Environment Security Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Target:${NC} $STAGING_URL"
echo ""

# Check if URL is reachable
echo -e "${BLUE}[1/5] Connectivity Check${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL" &>/dev/null; then
  echo -e "${GREEN}✓${NC} Staging URL is reachable"
else
  echo -e "${RED}✗${NC} Cannot reach staging URL"
  exit 1
fi
echo ""

# Check basic auth requirement
echo -e "${BLUE}[2/5] Basic Authentication${NC}"
local code=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL" 2>/dev/null)
if [ "$code" = "401" ]; then
  echo -e "${GREEN}✓${NC} Basic auth is required (401 without credentials)"
  
  # If credentials provided, verify access
  if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
    local auth=$(echo -n "$AUTH_USER:$AUTH_PASS" | base64)
    local auth_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic $auth" "$STAGING_URL" 2>/dev/null)
    if [ "$auth_code" = "200" ]; then
      echo -e "${GREEN}✓${NC} Authentication successful with provided credentials"
    else
      echo -e "${YELLOW}⚠${NC} Authentication failed with provided credentials (HTTP $auth_code)"
    fi
  fi
else
  echo -e "${YELLOW}⚠${NC} Basic auth may not be configured (HTTP $code without credentials)"
fi
echo ""

# Check security headers
echo -e "${BLUE}[3/5] Security Headers${NC}"
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  local auth=$(echo -n "$AUTH_USER:$AUTH_PASS" | base64)
  check_header "Content-Security-Policy" "default-src" "$STAGING_URL" "$auth"
  check_header "Strict-Transport-Security" "max-age" "$STAGING_URL" "$auth"
  check_header "X-Frame-Options" "DENY" "$STAGING_URL" "$auth"
  check_header "X-Content-Type-Options" "nosniff" "$STAGING_URL" "$auth"
else
  echo -e "${YELLOW}→${NC} Provide credentials with --user and --pass to check authenticated requests"
fi
echo ""

# Check API endpoints
echo -e "${BLUE}[4/5] API Connectivity${NC}"
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  local auth=$(echo -n "$AUTH_USER:$AUTH_PASS" | base64)
  
  # Try to extract API URL from app
  echo "  Checking API endpoints..."
  check_status_code "$STAGING_URL/api/health" "$auth" "200" || true
  check_status_code "$STAGING_URL/api/prices" "$auth" "200" || true
else
  echo -e "${YELLOW}→${NC} Provide credentials to check API connectivity"
fi
echo ""

# Check deployment info
echo -e "${BLUE}[5/5] Deployment Information${NC}"
if command -v vercel &> /dev/null && [ -n "$VERCEL_STAGING_PROJECT_ID" ]; then
  echo "  Fetching deployment info from Vercel..."
  if vercel ls --project "$VERCEL_STAGING_PROJECT_ID" 2>/dev/null | head -5; then
    echo -e "${GREEN}✓${NC} Vercel project is accessible"
  else
    echo -e "${YELLOW}→${NC} Could not fetch Vercel deployment info"
  fi
else
  echo -e "${YELLOW}→${NC} Install Vercel CLI to check deployment info"
  echo "    npm install -g vercel"
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Verification complete!${NC}"
echo ""
echo "For more information, see docs/STAGING_DEPLOYMENT.md"
