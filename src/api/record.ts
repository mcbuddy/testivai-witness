import { Page, Frame, ElementHandle } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs-extra';
import { loadConfig } from '../core/ConfigService';
import { StateLogger } from '../core/StateLogger';
import { TestivAIConfig } from '../types/config';

/**
 * Supported target types for capturing
 */
export type TestTarget = Page | Frame | ElementHandle;

/**
 * Cached configuration
 */
let cachedConfig: TestivAIConfig | null = null;

/**
 * Get or load the configuration
 */
function getConfig(): TestivAIConfig {
  if (!cachedConfig) {
    const configPath = path.join(process.cwd(), 'testivai.config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(
        'TestivAI is not initialized. Please run "npx tsvai init" first.'
      );
    }
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Generate a filename from URL pathname
 */
function generateNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Convert pathname to filename: /products/item -> products-item
    const pathname = urlObj.pathname
      .replace(/^\/|\/$/g, '') // Remove leading/trailing slashes
      .replace(/\//g, '-')      // Replace slashes with dashes
      .replace(/[^a-zA-Z0-9-]/g, ''); // Remove special characters
    
    return pathname || 'index';
  } catch {
    return 'unknown';
  }
}

/**
 * Detect environment based on viewport size
 */
function detectEnvironment(viewport: { width: number; height: number }, config: TestivAIConfig): string {
  // Find the closest matching environment
  for (const [envName, envConfig] of Object.entries(config.environments)) {
    if (viewport.width === envConfig.width && viewport.height === envConfig.height) {
      return envName;
    }
  }
  
  // If no exact match, return a descriptive name
  return `${viewport.width}x${viewport.height}`;
}

/**
 * Get the page object from various target types
 */
async function getPageFromTarget(target: TestTarget): Promise<Page> {
  if ('url' in target && 'screenshot' in target) {
    return target as Page;
  } else if ('page' in target && typeof (target as any).page === 'function') {
    // Frame has page() method
    return await (target as Frame).page();
  } else if ('ownerFrame' in target) {
    // ElementHandle - get the frame first, then the page
    const frame = await (target as ElementHandle).ownerFrame();
    if (!frame) {
      throw new Error('ElementHandle has no owner frame');
    }
    return await frame.page();
  }
  throw new Error('Invalid target type');
}

/**
 * Main record function for capturing UI state
 * @param name - Optional name for the capture (defaults to URL-based name)
 * @param target - Playwright Page, Frame, or ElementHandle to capture
 */
async function record(name?: string, target?: TestTarget): Promise<void> {
  const logger = StateLogger.getInstance();

  try {
    // Validate inputs
    if (!target) {
      throw new Error('Target is required for record()');
    }

    // Get configuration
    const config = getConfig();

    // Get the page object
    const page = await getPageFromTarget(target);
    
    // Generate name if not provided
    const url = page.url();
    const captureName = name || generateNameFromUrl(url);
    
    // Ensure current directory exists
    const currentDir = path.join(process.cwd(), config.paths.current);
    await fs.ensureDir(currentDir);
    
    // Calculate screenshot path
    const screenshotFilename = `${captureName}.png`;
    const screenshotPath = path.join(currentDir, screenshotFilename);
    
    // Get viewport information
    const viewport = page.viewportSize() || { width: 1920, height: 1080 };
    const environment = detectEnvironment(viewport, config);
    
    // Capture screenshot
    if ('screenshot' in target) {
      await (target as Page | ElementHandle).screenshot({
        path: screenshotPath,
        fullPage: true,
      });
    } else {
      // Frame doesn't have screenshot method, use page
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
    }
    
    // Capture DOM snippet
    let domSnippet = '';
    try {
      if ('locator' in target) {
        domSnippet = await target.locator('body').innerHTML();
      } else if ('innerHTML' in target) {
        // ElementHandle
        domSnippet = await (target as ElementHandle).innerHTML();
      }
    } catch (domError) {
      console.error(`Warning: Failed to capture DOM snippet: ${domError}`);
      domSnippet = '<error>Failed to capture DOM</error>';
    }
    
    // Get test context if available
    const testInfo = (global as any).__testInfo;
    
    // Log the capture metadata
    logger.logCapture({
      name: captureName,
      screenshotPath: path.relative(process.cwd(), screenshotPath),
      domSnippet,
      environment,
      viewport,
      testFile: testInfo?.file,
      testTitle: testInfo?.title,
    }, testInfo?.file);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`TestivAI record() error: ${errorMessage}`);
    
    // Log the error in metadata
    logger.logCapture({
      name: name || 'error',
      screenshotPath: '',
      domSnippet: '',
      error: errorMessage,
    });
  }
}

/**
 * Clear the configuration cache (useful for testing or config updates)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

export default record;
