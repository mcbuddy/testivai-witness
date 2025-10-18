# @testivai/witness

**TestivAI Witness Adapter** - The foundational client-side tool for capturing and verifying immutable UI state evidence.

## Overview

The `@testivai/witness` package is a Node.js/TypeScript-based adapter that provides reliable state-based visual testing for Playwright. It decouples browser automation from AI intelligence, enabling secure and efficient visual regression testing.

## Installation

```bash
npm install @testivai/witness
```

## Quick Start

1. **Initialize TestivAI in your project:**
```bash
npx tsvai init
```

2. **Use in your Playwright tests:**
```typescript
import { testivai } from '@testivai/witness';

test('visual test example', async ({ page }) => {
  await page.goto('https://example.com');
  await testivai.record('homepage');
});
```

3. **Run verification:**
```bash
npx tsvai verify
```

4. **View results locally:**
```bash
npx tsvai serve
```

5. **Approve changes:**
```bash
npx tsvai approve <name>
```

## The Three Pillars

### I. Capture (The Sensor)
Uses native Playwright API to capture UI state and save as image artifacts.

### II. Verification (The Auditor)
Runs Pixelmatch comparison against baseline and generates the TestivAI Insight Dashboard.

### III. Baseline Management
Provides security gate for approving and committing visual changes.

## Features

- 🎯 **Agnostic Architecture** - Works seamlessly with Python AI backend
- 🔒 **Security First** - Dual-mode reporting (local actionable, CI read-only)
- 📊 **Rich Reporting** - HTML dashboard with visual diffs
- 🚀 **Developer Friendly** - Simple CLI commands
- 🔄 **No Cloud PII** - All data stays local

## License

MIT

## Author

budi
