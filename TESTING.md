# Testing @testivai/witness Locally

This guide explains how to test the package locally before publishing to npm.

## Method 1: Using npm link (Recommended)

### 1. Build and link the package
```bash
cd /home/budi/code/testivai/witness
npm run build
npm link
```

### 2. Create a test project
```bash
mkdir -p ~/test-testivai
cd ~/test-testivai
npm init -y
npm install @playwright/test
npm link @testivai/witness
```

### 3. Initialize TestivAI
```bash
npx tsvai init
```

### 4. Create a test file
Create `tests/example.spec.ts`:
```typescript
import { test } from '@playwright/test';
import { testivai } from '@testivai/witness';

test('homepage test', async ({ page }) => {
  await page.goto('https://example.com');
  await testivai.record('homepage');
});
```

### 5. Configure Playwright
Update `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['html'],
    ['@testivai/witness/reporter']
  ],
});
```

### 6. Run tests
```bash
npx playwright test
```

### 7. Verify and view results
```bash
npx tsvai verify
npx tsvai serve
```

### 8. Test approval
```bash
# Single approval
npx tsvai approve homepage

# Bulk approval
npx tsvai approve --all
```

### 9. Cleanup (when done testing)
```bash
cd ~/test-testivai
npm unlink @testivai/witness

cd /home/budi/code/testivai/witness
npm unlink
```

## Method 2: Using npm pack

### 1. Create a tarball
```bash
cd /home/budi/code/testivai/witness
npm run build
npm pack
```

This creates `testivai-witness-1.0.0.tgz`

### 2. Install in test project
```bash
mkdir -p ~/test-testivai
cd ~/test-testivai
npm init -y
npm install @playwright/test
npm install /home/budi/code/testivai/witness/testivai-witness-1.0.0.tgz
```

### 3. Follow steps 3-8 from Method 1

## Verification Checklist

Test all CLI commands:
- [ ] `tsvai --version` - Shows version
- [ ] `tsvai --help` - Shows help
- [ ] `tsvai init` - Creates config and directories
- [ ] `tsvai verify` - Runs verification
- [ ] `tsvai serve` - Starts server
- [ ] `tsvai approve <name>` - Approves single snapshot
- [ ] `tsvai approve --all` - Approves all with confirmation

Test API:
- [ ] `testivai.record()` - Captures screenshots
- [ ] Reporter integration - Generates payload
- [ ] Multi-environment support - Works with different viewports

Test Dashboard:
- [ ] Opens in browser
- [ ] Shows summary statistics
- [ ] Filters work (All, Failed, New, Passed, Missing, Errors)
- [ ] Three-panel comparison visible
- [ ] Approve buttons hidden when opened directly
- [ ] Approve buttons visible when server running
- [ ] Auto-refresh works (every 10 seconds)
- [ ] Approval workflow completes successfully

## Publishing to npm

Once testing is complete:

```bash
# Make sure you're logged in to npm
npm login

# Publish (this will run build and tests automatically)
npm publish --access public
```

## Troubleshooting

### "Cannot find module @testivai/witness"
- Make sure you ran `npm link` in the package directory
- Make sure you ran `npm link @testivai/witness` in the test project

### "tsvai: command not found"
- Run `npm link` again in the package directory
- Check if the bin is linked: `which tsvai`

### Build errors
- Clean and rebuild: `npm run clean && npm run build`
- Check TypeScript errors: `npx tsc --noEmit`

### Tests failing
- Run tests: `npm test`
- Check test coverage: `npm run test:coverage`
