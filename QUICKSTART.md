# Quick Start - Testing @testivai/witness

## 🚀 5-Minute Test

### 1. Create Test Project
```bash
mkdir ~/test-testivai && cd ~/test-testivai
npm init -y
npm install @playwright/test
npm link @testivai/witness
```

### 2. Initialize TestivAI
```bash
npx tsvai init
```

### 3. Create Test File
```bash
mkdir -p tests
cat > tests/example.spec.ts << 'TEST'
import { test } from '@playwright/test';
import { testivai } from '@testivai/witness';

test('homepage visual test', async ({ page }) => {
  await page.goto('https://example.com');
  await testivai.record('homepage');
  
  await page.goto('https://playwright.dev');
  await testivai.record('playwright-homepage');
});
TEST
```

### 4. Configure Playwright
```bash
cat > playwright.config.ts << 'CONFIG'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['html'],
    ['@testivai/witness/reporter']
  ],
});
CONFIG
```

### 5. Run Complete Workflow
```bash
# Run tests (captures screenshots)
npx playwright test

# Run verification (compare & generate dashboard)
npx tsvai verify

# Start server and view dashboard
npx tsvai serve
# Open http://localhost:3000 in browser

# Approve all changes (in another terminal)
npx tsvai approve --all
```

## ✅ What to Check

1. **CLI Works**: `tsvai --version` shows `1.0.0`
2. **Init Creates**: `.testivai/` directory and `testivai.config.json`
3. **Tests Run**: Screenshots saved to `.testivai/artifacts/current/`
4. **Verify Works**: Dashboard at `.testivai/reports/index.html`
5. **Server Starts**: Opens on port 3000 (or next available)
6. **Dashboard Shows**:
   - Summary statistics
   - Three-panel comparison
   - Approve buttons (only when server running)
   - Filters work
7. **Approval Works**: Baselines updated, diffs deleted

## 🎯 Expected Results

After first run:
- 2 screenshots captured
- 2 "new" status (no baselines yet)
- Dashboard shows both as new
- After approval: baselines created

After second run (no changes):
- 2 "passed" status
- No approve buttons needed

After making changes:
- "failed" status for changed screenshots
- Approve buttons appear
- Can approve via dashboard or CLI

## 📝 Quick Commands Reference

```bash
# CLI
tsvai init                    # Initialize
tsvai verify                  # Run VRT
tsvai serve                   # Start server
tsvai approve <name>          # Approve one
tsvai approve --all           # Approve all

# Cleanup when done
cd ~/test-testivai
npm unlink @testivai/witness
cd /home/budi/code/testivai/witness
npm unlink
```

## 🐛 Troubleshooting

**Approve buttons not showing?**
→ Start server with `npx tsvai serve`

**Port 3000 in use?**
→ Server auto-tries 3001, 3002, etc.

**Module not found?**
→ Run `npm link` in package dir, then `npm link @testivai/witness` in test project

---

**Happy Testing\!** 🎉
