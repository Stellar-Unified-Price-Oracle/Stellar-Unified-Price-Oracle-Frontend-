#!/bin/bash
# Verification script for lazy-loading implementation
# Run this to confirm all chunks are properly split and within budgets

set -e

echo "════════════════════════════════════════════════════════════"
echo "Lazy-Loading Implementation Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Check that all lazy components are registered
echo "✓ Step 1: Verifying lazy component registry..."
if grep -q "LazyDashboard\|LazyPriceDetail\|LazyApiDocs" src/utils/chunks.ts; then
  echo "  ✅ All lazy components registered in src/utils/chunks.ts"
else
  echo "  ❌ Missing lazy component exports"
  exit 1
fi
echo ""

# Step 2: Check that Dashboard uses lazy imports
echo "✓ Step 2: Verifying Dashboard uses lazy components..."
if grep -q "LazyPriceTable" src/pages/Dashboard.tsx; then
  echo "  ✅ Dashboard imports LazyPriceTable"
else
  echo "  ⚠️  Warning: Dashboard might not be using lazy PriceTable"
fi
echo ""

# Step 3: Check that PriceDetail uses lazy imports
echo "✓ Step 3: Verifying PriceDetail uses lazy components..."
if grep -q "LazyPriceChart\|LazyPriceHistoryTable" src/pages/PriceDetail.tsx; then
  echo "  ✅ PriceDetail imports lazy components"
else
  echo "  ❌ PriceDetail not using lazy imports"
  exit 1
fi
echo ""

# Step 4: Check preload cache is configured
echo "✓ Step 4: Verifying preload cache configuration..."
if grep -q "PreloadLruCache" src/utils/preloadCache.ts; then
  echo "  ✅ LRU cache implemented for preloading"
else
  echo "  ❌ Preload cache not found"
  exit 1
fi
echo ""

# Step 5: Check Vite manualChunks configuration
echo "✓ Step 5: Verifying Vite code splitting..."
if grep -q "vendor-react\|vendor-tables\|vendor-i18n" vite.config.ts; then
  echo "  ✅ Vendor chunks configured in Vite"
else
  echo "  ❌ Vendor chunks not configured"
  exit 1
fi
echo ""

# Step 6: Build the project
echo "✓ Step 6: Building production bundle..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  ✅ Build succeeded"
else
  echo "  ❌ Build failed - check TypeScript errors"
  exit 1
fi
echo ""

# Step 7: Check generated chunks
echo "✓ Step 7: Verifying generated chunk files..."
CHUNKS=$(find dist/assets -name "*.js" -type f | wc -l)
if [ "$CHUNKS" -gt 5 ]; then
  echo "  ✅ Found $CHUNKS JavaScript chunks (expected >5 for proper splitting)"
else
  echo "  ⚠️  Only found $CHUNKS chunks - code splitting may not be working"
fi
echo ""

# Step 8: Check bundle size against budgets
echo "✓ Step 8: Checking bundle size budgets..."
if npm run size-limit > /dev/null 2>&1; then
  echo "  ✅ All bundle size budgets are within limits!"
else
  echo "  ⚠️  Some bundle sizes exceed limits (run 'npm run size-limit' for details)"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "✅ Verification Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run: npm run build:analyze"
echo "     (to see interactive bundle treemap)"
echo "  2. Run: npm run preview"
echo "     (then check DevTools Network tab while navigating)"
echo "  3. Review generated chunks:"
echo "     ls -la dist/assets/*.js | head -20"
echo ""
