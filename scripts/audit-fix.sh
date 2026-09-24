#!/bin/bash

# NPM Audit Vulnerability Remediation Script
# Safely fixes all identified vulnerabilities from npm audit
# 
# Usage: bash scripts/audit-fix.sh

set -e

echo "════════════════════════════════════════════════════════════"
echo "NPM Audit Vulnerability Remediation"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Backup current package-lock.json
echo -e "${BLUE}Step 1: Backing up package-lock.json${NC}"
if [ -f package-lock.json ]; then
  cp package-lock.json package-lock.json.backup
  echo -e "${GREEN}✓ Backup created: package-lock.json.backup${NC}"
else
  echo -e "${YELLOW}⚠ No package-lock.json found${NC}"
fi
echo ""

# Step 2: Run npm audit fix for patch-level updates
echo -e "${BLUE}Step 2: Applying patch-level fixes (safe)${NC}"
echo "This will update:"
echo "  - dompurify: 3.4.12 → 3.4.13+ (moderate: XSS fix)"
echo "  - nanoid: <3.3.18 → 3.3.18+ (high: infinite loop fix)"
echo "  - js-yaml: 4.x → 4.3.1+ (high: DoS fix)"
echo ""

npm audit fix
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Patch updates applied successfully${NC}"
else
  echo -e "${RED}✗ npm audit fix failed${NC}"
  exit 1
fi
echo ""

# Step 3: Update Playwright (requires separate handling)
echo -e "${BLUE}Step 3: Updating Playwright (dev-only, SSL cert verification fix)${NC}"
echo "Updating: @playwright/test & playwright from 1.52.0 → 1.62.1+"
echo ""

npm install @playwright/test@latest --save-dev
npm install playwright@latest --save-dev

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Playwright updated successfully${NC}"
else
  echo -e "${RED}✗ Playwright update failed${NC}"
  exit 1
fi
echo ""

# Step 4: Quick verification
echo -e "${BLUE}Step 4: Quick verification${NC}"
echo "Running typecheck..."
npm run typecheck
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ TypeScript compilation OK${NC}"
else
  echo -e "${RED}✗ TypeScript compilation failed${NC}"
  exit 1
fi
echo ""

echo "Running unit tests..."
npm run test:run
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Unit tests passed${NC}"
else
  echo -e "${RED}✗ Unit tests failed${NC}"
  echo -e "${YELLOW}Run 'npm run test:run' to debug${NC}"
  exit 1
fi
echo ""

# Step 5: Final audit check
echo -e "${BLUE}Step 5: Final audit check${NC}"
npm audit
AUDIT_EXIT=$?

if [ $AUDIT_EXIT -eq 0 ]; then
  echo -e "${GREEN}✓ No vulnerabilities remaining!${NC}"
elif [ $AUDIT_EXIT -eq 1 ]; then
  # npm audit returns 1 when vulnerabilities found
  echo -e "${YELLOW}⚠ Some vulnerabilities remain (may be false positives)${NC}"
  echo "  Review npm audit output above"
else
  echo -e "${RED}✗ npm audit check failed${NC}"
  exit 1
fi
echo ""

# Step 6: Summary
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}Remediation Complete!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run full E2E tests: npm run test:e2e:chromium"
echo "  2. Review changes: git diff package.json package-lock.json"
echo "  3. Commit changes: git add package.json package-lock.json"
echo "  4. Commit message: 'chore: resolve npm audit vulnerabilities'"
echo ""
echo "If something broke:"
echo "  - Restore from backup: cp package-lock.json.backup package-lock.json"
echo "  - Run: npm ci"
echo ""
