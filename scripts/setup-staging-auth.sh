#!/bin/bash
#
# setup-staging-auth.sh
# Sets up basic authentication for the staging environment.
#
# This script generates base64-encoded credentials and configures
# them in the Vercel staging project via the CLI.
#
# Usage:
#   ./scripts/setup-staging-auth.sh
#   ./scripts/setup-staging-auth.sh --username staging-user --password $(openssl rand -base64 16)
#
# Prerequisites:
#   - vercel CLI installed (npm install -g vercel)
#   - Authenticated with Vercel (vercel login)
#   - VERCEL_PROJECT_ID or VERCEL_ORG_ID set for staging project
#
# Output:
#   - Generates base64-encoded credentials for basic auth
#   - Updates GitHub repository secrets
#   - Updates Vercel environment variables
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STAGING_PROJECT="${VERCEL_STAGING_PROJECT_ID:-}"
USERNAME="${1:-}"
PASSWORD="${2:-}"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --username)
      USERNAME="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --project)
      STAGING_PROJECT="$2"
      shift 2
      ;;
    --help)
      cat <<EOF
Usage: ./scripts/setup-staging-auth.sh [OPTIONS]

Options:
  --username USERNAME    Basic auth username (default: generated)
  --password PASSWORD    Basic auth password (default: generated)
  --project PROJECT_ID   Vercel staging project ID
  --help                Show this help message

Environment Variables:
  VERCEL_STAGING_PROJECT_ID    Vercel staging project ID
  VERCEL_TOKEN                 Vercel API token
  VERCEL_ORG_ID                Vercel organization ID

Examples:
  # Generate random credentials
  ./scripts/setup-staging-auth.sh

  # Use custom username and auto-generate password
  ./scripts/setup-staging-auth.sh --username staging-user

  # Use custom credentials
  ./scripts/setup-staging-auth.sh --username staging-user --password my-secure-password
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate environment
if [ -z "$STAGING_PROJECT" ]; then
  echo -e "${RED}✗ Error: VERCEL_STAGING_PROJECT_ID not set${NC}"
  echo "Set it via:"
  echo "  export VERCEL_STAGING_PROJECT_ID=<project-id>"
  echo "Or pass it as an argument:"
  echo "  --project <project-id>"
  exit 1
fi

# Generate credentials if not provided
if [ -z "$USERNAME" ]; then
  USERNAME="staging-user-$(date +%s | tail -c 5)"
  echo -e "${YELLOW}→ Generated username: ${GREEN}$USERNAME${NC}"
fi

if [ -z "$PASSWORD" ]; then
  if command -v openssl &> /dev/null; then
    PASSWORD=$(openssl rand -base64 16)
  else
    PASSWORD=$(head -c 16 /dev/urandom | base64)
  fi
  echo -e "${YELLOW}→ Generated password: ${GREEN}$PASSWORD${NC}"
fi

# Encode credentials for basic auth
CREDENTIALS="$USERNAME:$PASSWORD"
BASIC_AUTH=$(echo -n "$CREDENTIALS" | base64)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Staging Basic Auth Credentials${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Username:  ${GREEN}$USERNAME${NC}"
echo -e "Password:  ${GREEN}$PASSWORD${NC}"
echo ""
echo -e "Basic Auth Header:"
echo -e "  ${GREEN}Authorization: Basic $BASIC_AUTH${NC}"
echo ""
echo -e "${YELLOW}⚠ Store these credentials securely!${NC}"
echo "  - 1Password, LastPass, or similar vault"
echo "  - GitHub repository secrets"
echo "  - Vercel environment variables"
echo -e "  - ${RED}Never commit to version control${NC}"
echo ""

# Check for GitHub CLI
if command -v gh &> /dev/null; then
  echo -e "${YELLOW}→ Updating GitHub repository secrets...${NC}"
  
  if gh secret set STAGING_BASIC_AUTH_USER --body "$USERNAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Set STAGING_BASIC_AUTH_USER${NC}"
  else
    echo -e "${RED}✗ Failed to set STAGING_BASIC_AUTH_USER${NC}"
    echo "  Run this manually:"
    echo "    gh secret set STAGING_BASIC_AUTH_USER --body '$USERNAME'"
  fi
  
  if gh secret set STAGING_BASIC_AUTH_PASS --body "$PASSWORD" 2>/dev/null; then
    echo -e "${GREEN}✓ Set STAGING_BASIC_AUTH_PASS${NC}"
  else
    echo -e "${RED}✗ Failed to set STAGING_BASIC_AUTH_PASS${NC}"
    echo "  Run this manually:"
    echo "    gh secret set STAGING_BASIC_AUTH_PASS --body '$PASSWORD'"
  fi
  echo ""
else
  echo -e "${YELLOW}→ GitHub CLI not found. Update secrets manually:${NC}"
  echo "  gh secret set STAGING_BASIC_AUTH_USER --body '$USERNAME'"
  echo "  gh secret set STAGING_BASIC_AUTH_PASS --body '$PASSWORD'"
  echo ""
fi

# Check for Vercel CLI
if command -v vercel &> /dev/null; then
  echo -e "${YELLOW}→ Updating Vercel environment variables...${NC}"
  
  if vercel env add STAGING_BASIC_AUTH_USER "$USERNAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Set STAGING_BASIC_AUTH_USER in Vercel${NC}"
  else
    echo -e "${YELLOW}Note: Vercel env update via CLI may require manual dashboard config${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}→ Vercel CLI not found. Update environment manually:${NC}"
  echo "  1. Open Vercel dashboard → Staging project → Settings"
  echo "  2. Environment Variables"
  echo "  3. Add:"
  echo "     STAGING_BASIC_AUTH_USER = $USERNAME"
  echo "     STAGING_BASIC_AUTH_PASS = $PASSWORD"
  echo ""
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Next Steps:${NC}"
echo ""
echo "1. Configure Vercel staging project:"
echo "   → Go to: https://vercel.com/dashboard"
echo "   → Select: Stellar Oracle (Staging)"
echo "   → Settings → Protected Routes"
echo "   → Enable 'Require authentication'"
echo "   → Set basic auth credentials above"
echo ""
echo "2. Test access to staging:"
echo "   → URL: https://staging.example.com"
echo "   → Enter username: $USERNAME"
echo "   → Enter password: $PASSWORD"
echo ""
echo "3. Share credentials securely with team:"
echo "   → Use 1Password or similar vault"
echo "   → Never share in Slack, email, or chat"
echo ""
echo -e "${GREEN}Setup complete!${NC}"
