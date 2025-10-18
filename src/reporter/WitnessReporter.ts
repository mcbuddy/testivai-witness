import {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import { StateLogger } from '../core/StateLogger';
import { sendIngestion, writePayloadToFile } from '../core/HttpSender';
import { getBuildId } from '../utils/buildId';
import { loadConfig } from '../core/ConfigService';

/**
 * Normalized JSON payload structure
 */
interface TestivAIPayload {
  accountId: string;
  buildId: string;
  timestamp: string;
  captures: any[];
  testFiles: string[];
}

/**
 * Custom Playwright reporter for TestivAI
 * Collects visual captures and sends them to the API
 */
export default class WitnessReporter implements Reporter {
  private config: FullConfig | null = null;
  private testFiles: Set<string> = new Set();
  private startTime: Date = new Date();
  private quiet: boolean = false;

  constructor(options?: { quiet?: boolean }) {
    this.quiet = options?.quiet || process.env.TESTIVAI_QUIET === 'true';
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.startTime = new Date();
    if (!this.quiet) {
      console.log('TestivAI: Starting visual capture collection...');
    }
  }

  onTestBegin(test: TestCase): void {
    // Track test files
    if (test.location?.file) {
      this.testFiles.add(test.location.file);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // StateLogger is already populated by record() calls during the test
    // We just need to track which test files have run
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      const logger = StateLogger.getInstance();
      const allCaptures = logger.getCaptures();

      if (allCaptures.length === 0) {
        if (!this.quiet) {
          console.log('TestivAI: No captures to send');
        }
        return;
      }

      // Build the normalized payload
      const payload: TestivAIPayload = {
        accountId: process.env.TESTIVAI_KEY || 'FREE-TIER-USER',
        buildId: getBuildId(),
        timestamp: new Date().toISOString(),
        captures: allCaptures,
        testFiles: Array.from(this.testFiles),
      };

      // Write to file for debugging
      await writePayloadToFile(payload, 'last-run.json');

      // Check if we should send to API
      const testivaiConfig = loadConfig();
      const shouldSend = testivaiConfig.api?.enabled !== false;

      if (shouldSend) {
        // Send to API
        const response = await sendIngestion(payload);
        
        if (!response.success && !this.quiet) {
          console.error(`TestivAI: Failed to send captures - ${response.error}`);
        }
      } else if (!this.quiet) {
        console.log('TestivAI: API disabled, captures saved locally only');
      }

      // Clear captures after sending to free memory
      logger.clear();

      // Summary
      if (!this.quiet) {
        const duration = (Date.now() - this.startTime.getTime()) / 1000;
        console.log(`TestivAI: Completed in ${duration.toFixed(1)}s`);
        console.log(`  - Captures: ${allCaptures.length}`);
        console.log(`  - Test files: ${this.testFiles.size}`);
        console.log(`  - Build ID: ${payload.buildId}`);
      }
    } catch (error) {
      // Never fail the test run due to reporter errors
      console.error('TestivAI Reporter error:', error);
    }
  }

  printsToStdio(): boolean {
    return !this.quiet;
  }
}

/**
 * Factory function for Playwright config
 * Usage in playwright.config.ts:
 * 
 * export default {
 *   reporter: [
 *     ['html'],
 *     ['@testivai/witness/reporter']
 *   ]
 * }
 */
export function createReporter(options?: { quiet?: boolean }) {
  return new WitnessReporter(options);
}
