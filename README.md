# @testivai/witness

**TestivAI Witness Adapter** - The foundational client-side tool for capturing and verifying immutable UI state evidence.

## Overview

The `@testivai/witness` package is a Node.js/TypeScript-based adapter that provides reliable state-based visual testing for Playwright. It decouples browser automation from AI intelligence, enabling secure and efficient visual regression testing with a beautiful local dashboard.

## Installation

```bash
npm install @testivai/witness
```

## Quick Start

### 1. Initialize TestivAI in your project
```bash
npx tsvai init
```

This creates:
- `testivai.config.json` - Configuration file
- `.testivai/` directory structure for artifacts
- `.gitignore` entries for current/diff directories

### 2. Configure Playwright Reporter

Add to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html'],
    ['@testivai/witness/reporter']
  ],
  // ... other config
});
```

### 3. Use in your Playwright tests

```typescript
import { test } from '@playwright/test';
import { testivai } from '@testivai/witness';

test('homepage visual test', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Capture full page screenshot
  await testivai.record('homepage');
  
  // Capture with custom options
  await testivai.record('homepage-mobile', {
    fullPage: true,
    mask: [page.locator('.dynamic-content')]
  });
});
```

### 4. Run your tests
```bash
npx playwright test
```

Screenshots are automatically captured and organized by test file.

### 5. Run verification
```bash
npx tsvai verify
```

This will:
- Compare current screenshots against baselines using Pixelmatch
- Calculate diff pixel ratios
- Generate visual diff images
- Create an HTML dashboard at `.testivai/reports/index.html`

### 6. View results locally
```bash
npx tsvai serve
```

Opens a local server (default port 3000) with:
- Interactive dashboard with visual comparisons
- Filter by status (All, Failed, New, Passed, Missing, Errors)
- Three-panel view (Baseline | Current | Diff)
- **Approve buttons** (only visible when server is running)
- Auto-refresh every 10 seconds

### 7. Approve changes

**Option 1: Via Dashboard**
- Click "Approve Change" button in the dashboard
- Changes are applied immediately
- Page auto-refreshes to show updated status

**Option 2: Via CLI (single)**
```bash
npx tsvai approve homepage
```

**Option 3: Via CLI (bulk)**
```bash
npx tsvai approve --all
```
Prompts for confirmation before approving all failed/new snapshots.

## The Three Pillars

### I. Capture (The Sensor)
**Playwright Integration & State Logging**

- **API Function**: `testivai.record(name, options?)`
- **Playwright Reporter**: Automatic test lifecycle integration
- **Multi-Environment Support**: Configure multiple viewport sizes
- **State Logger**: Thread-safe capture management with 1000 capture limit per test file
- **Artifact Organization**: Structured by test file for parallel execution
- **Screenshot Options**: Full page, clipping, masking, animations control

**Key Features:**
- Zero-config screenshot capture
- Automatic file naming and organization
- Support for parallel test execution
- Normalized JSON payload generation
- Build ID detection (CI environment aware)

### II. Verification (The Auditor)
**VRT Processor & Comparison Engine**

- **Comparison Engine**: Pixelmatch for pixel-perfect diff detection
- **Threshold Configuration**: Default 0.001 (0.1%), user-configurable
- **Status Types**:
  - ✅ `passed` - Diff within threshold
  - ❌ `failed` - Diff exceeds threshold
  - ➕ `new` - No baseline exists (auto-approved)
  - ⚠️ `missing` - Baseline exists but current missing
  - 🔴 `error` - Comparison failed (e.g., dimension mismatch)

**Dashboard Features:**
- Percy.io-inspired modern UI
- Summary statistics (Total, Passed, Failed, New, Missing, Errors)
- Interactive filters
- Three-panel comparison view
- Responsive design (mobile/desktop)
- Self-contained reports (portable HTML)

### III. Baseline Management (Security Gate)
**Approval System with Security**

**Security Gate:**
- Health check endpoint (`GET /api/status`)
- Approve buttons **hidden by default**
- Buttons only visible when local server is running
- CI artifacts are **read-only** (secure by design)
- 5-second timeout for server detection
- Clear read-only mode messaging

**Approval Methods:**
1. **Dashboard** - Click "Approve Change" button
2. **CLI Single** - `npx tsvai approve <name>`
3. **CLI Bulk** - `npx tsvai approve --all` (with confirmation)

**Approval Process:**
- Copies current screenshot to baseline
- Deletes diff image automatically
- Git tracks baseline changes
- No audit log needed (Git history provides trail)

## CLI Commands

### `npx tsvai init`
Initialize TestivAI configuration and directory structure.

**Creates:**
- `testivai.config.json`
- `.testivai/artifacts/` directories
- `.gitignore` entries

### `npx tsvai verify`
Run visual regression testing.

**Process:**
1. Compares current vs baseline screenshots
2. Generates diff images
3. Creates HTML dashboard
4. Copies images to report directory

**Output:**
- `.testivai/reports/index.html` - Dashboard
- `.testivai/reports/images/` - Self-contained images
- `.testivai/artifacts/diffs/` - Diff images

**Exit Code:** Always 0 (unless report generation fails)

### `npx tsvai serve [--port <port>]`
Start local HTTP server for dashboard.

**Features:**
- Auto-finds available port (3000 → 3001 → 3002...)
- Serves static files from `.testivai/reports/`
- Provides API endpoints:
  - `GET /api/status` - Health check
  - `POST /api/accept-baseline` - Approve changes
- Graceful shutdown (Ctrl+C)
- Security: Path validation prevents directory traversal

**Options:**
- `--port, -p` - Port number (default: 3000)

### `npx tsvai approve [name] [--all]`
Approve visual changes and update baselines.

**Single Approval:**
```bash
npx tsvai approve homepage
```

**Bulk Approval:**
```bash
npx tsvai approve --all
```
- Prompts for confirmation
- Shows list of snapshots to approve
- Displays success/failure summary

## Configuration

### `testivai.config.json`

```json
{
  "artifactRoot": ".testivai/artifacts",
  "paths": {
    "baseline": ".testivai/artifacts/baselines",
    "current": ".testivai/artifacts/current",
    "diff": ".testivai/artifacts/diffs",
    "reports": ".testivai/reports"
  },
  "visualEngine": {
    "type": "pixelmatch",
    "threshold": 0.001,
    "includeAA": true,
    "alpha": 0.1,
    "diffColor": [255, 0, 0]
  },
  "environments": {
    "desktop-hd": {
      "width": 1920,
      "height": 1080
    },
    "tablet": {
      "width": 768,
      "height": 1024
    },
    "mobile": {
      "width": 375,
      "height": 667
    }
  },
  "api": {
    "enabled": false,
    "endpoint": "https://api.testivai.com/v1/ingest",
    "key": ""
  }
}
```

### Environment Variables

- `TESTIVAI_KEY` - API authentication key
- `TESTIVAI_API_URL` - Override API endpoint
- `TESTIVAI_QUIET` - Suppress console output
- `CI_BUILD_ID` - Group parallel test runs (auto-detected in CI)

## API Reference

### `testivai.record(name, options?)`

Capture a screenshot for visual testing.

**Parameters:**
- `name` (string) - Unique identifier for the screenshot
- `options` (object, optional) - Playwright screenshot options
  - `fullPage` (boolean) - Capture full scrollable page
  - `clip` (object) - Capture specific region
  - `mask` (Locator[]) - Elements to mask
  - `animations` ('disabled' | 'allow') - Control animations
  - `timeout` (number) - Maximum time in ms

**Returns:** Promise<void>

**Example:**
```typescript
// Basic usage
await testivai.record('homepage');

// Full page with masking
await testivai.record('dashboard', {
  fullPage: true,
  mask: [page.locator('.user-avatar'), page.locator('.timestamp')],
  animations: 'disabled'
});

// Specific region
await testivai.record('header', {
  clip: { x: 0, y: 0, width: 1920, height: 100 }
});
```

## Features

### 🎯 Agnostic Architecture
- Works seamlessly with Python AI backend
- Language-agnostic JSON payload format
- Decoupled capture and analysis

### 🔒 Security First
- **Dual-mode reporting**: Local actionable, CI read-only
- **Security gate**: Approve buttons only visible when server running
- **No cloud PII**: All data stays local
- **Git-based audit trail**: Baseline changes tracked in version control

### 📊 Rich Reporting
- Interactive dashboard design
- Three-panel visual comparison
- Interactive filters and search
- Summary statistics
- Self-contained portable HTML
- Auto-refresh (when server running)

### 🚀 Developer Friendly
- Simple CLI commands
- Zero-config setup
- TypeScript support
- Helpful error messages
- Clear console output

### ⚡ Performance
- Parallel test execution support
- Thread-safe state logging
- Efficient artifact organization
- Native Node.js HTTP server (zero dependencies)

### 🔄 CI/CD Integration
- Auto-detects CI environment
- Build ID grouping for parallel runs
- Exit code 0 for dashboard generation
- Playwright Reporter integration
- Optional API ingestion

## Architecture

### Directory Structure
```
.testivai/
├── artifacts/
│   ├── baselines/     # Committed to Git
│   ├── current/       # Gitignored (test artifacts)
│   └── diffs/         # Gitignored (comparison results)
└── reports/
    ├── index.html     # Dashboard
    ├── images/        # Self-contained images
    └── last-run.json  # Latest test results
```

### Workflow

1. **Test Execution**
   - Playwright runs tests
   - `testivai.record()` captures screenshots
   - StateLogger organizes by test file
   - Reporter generates normalized payload

2. **Verification**
   - `tsvai verify` compares current vs baseline
   - Pixelmatch calculates diff ratios
   - VRTProcessor generates diff images
   - ReportGenerator creates HTML dashboard

3. **Review & Approval**
   - `tsvai serve` starts local server
   - Security gate checks server status
   - Dashboard shows comparisons
   - Approve via UI or CLI
   - Baselines updated, diffs deleted

4. **Commit**
   - Git tracks baseline changes
   - Current/diff artifacts gitignored
   - CI runs read-only verification

## Troubleshooting

### Approve buttons not showing
**Solution:** Start the local server with `npx tsvai serve`. Buttons are hidden by default for security.

### Port already in use
**Solution:** Server automatically tries next available port (3000 → 3001 → 3002...). Or specify: `npx tsvai serve --port 3005`

### Permission denied errors
**Solution:** Check file permissions on `.testivai/` directory. Ensure write access for baseline updates.

### Dimension mismatch errors
**Solution:** Ensure screenshots are captured with consistent viewport sizes. Check `environments` in config.

### Tests not capturing screenshots
**Solution:** 
1. Verify Playwright reporter is configured
2. Check `testivai.record()` is called in tests
3. Ensure `.testivai/artifacts/current/` directory exists

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

budi
