import * as fs from 'fs-extra';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatchModule from 'pixelmatch';
import { loadConfig } from './ConfigService';

// Handle both ES module and CommonJS
const pixelmatch = (pixelmatchModule as any).default || pixelmatchModule;

/**
 * Status of a visual comparison
 */
export type ComparisonStatus = 'passed' | 'failed' | 'new' | 'missing' | 'error';

/**
 * Result of a single visual comparison
 */
export interface ComparisonResult {
  name: string;
  status: ComparisonStatus;
  diffPixelRatio: number;
  diffPixelCount: number;
  totalPixels: number;
  baselinePath?: string;
  currentPath?: string;
  diffPath?: string;
  error?: string;
  threshold: number;
}

/**
 * Summary of all comparisons
 */
export interface VerificationSummary {
  total: number;
  passed: number;
  failed: number;
  new: number;
  missing: number;
  errors: number;
  results: ComparisonResult[];
  timestamp: string;
}

/**
 * Load and decode a PNG image
 */
async function loadImage(imagePath: string): Promise<PNG> {
  const buffer = await fs.readFile(imagePath);
  return PNG.sync.read(buffer);
}

/**
 * Save a PNG image
 */
async function saveImage(image: PNG, outputPath: string): Promise<void> {
  const buffer = PNG.sync.write(image);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, buffer);
}

/**
 * Compare two images using pixelmatch
 */
async function compareImages(
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  threshold: number
): Promise<{ diffPixelCount: number; totalPixels: number }> {
  const baseline = await loadImage(baselinePath);
  const current = await loadImage(currentPath);

  // Ensure images have the same dimensions
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }

  const { width, height } = baseline;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });

  const diffPixelCount = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    {
      threshold,
      includeAA: true,
      alpha: 0.1,
      diffColor: [255, 0, 0], // Red for differences
    }
  );

  // Save diff image
  await saveImage(diff, diffPath);

  return { diffPixelCount, totalPixels };
}

/**
 * Process a single screenshot comparison
 */
async function processComparison(
  name: string,
  baselinePath: string | null,
  currentPath: string | null,
  diffPath: string,
  threshold: number
): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    name,
    status: 'error',
    diffPixelRatio: 0,
    diffPixelCount: 0,
    totalPixels: 0,
    threshold,
  };

  try {
    // Case 1: No baseline (new screenshot)
    if (!baselinePath || !fs.existsSync(baselinePath)) {
      result.status = 'new';
      result.currentPath = currentPath || undefined;
      return result;
    }

    // Case 2: No current screenshot (missing/deleted test)
    if (!currentPath || !fs.existsSync(currentPath)) {
      result.status = 'missing';
      result.baselinePath = baselinePath;
      result.error = 'Current screenshot is missing. Test may have been deleted.';
      return result;
    }

    // Case 3: Compare baseline and current
    result.baselinePath = baselinePath;
    result.currentPath = currentPath;
    result.diffPath = diffPath;

    const { diffPixelCount, totalPixels } = await compareImages(
      baselinePath,
      currentPath,
      diffPath,
      threshold
    );

    result.diffPixelCount = diffPixelCount;
    result.totalPixels = totalPixels;
    result.diffPixelRatio = totalPixels > 0 ? diffPixelCount / totalPixels : 0;

    // Determine status based on threshold
    result.status = result.diffPixelRatio <= threshold ? 'passed' : 'failed';

    return result;
  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : String(error);
    result.baselinePath = baselinePath || undefined;
    result.currentPath = currentPath || undefined;
    return result;
  }
}

/**
 * Get all screenshot files from a directory
 */
async function getScreenshots(directory: string): Promise<Map<string, string>> {
  const screenshots = new Map<string, string>();

  if (!fs.existsSync(directory)) {
    return screenshots;
  }

  const files = await fs.readdir(directory);
  for (const file of files) {
    if (file.endsWith('.png')) {
      const name = path.basename(file, '.png');
      const fullPath = path.join(directory, file);
      screenshots.set(name, fullPath);
    }
  }

  return screenshots;
}

/**
 * Run visual regression testing
 * Compares current screenshots against baselines
 */
export async function runVerification(): Promise<VerificationSummary> {
  const config = loadConfig();
  const cwd = process.cwd();

  // Get paths
  const baselineDir = path.join(cwd, config.paths.baseline);
  const currentDir = path.join(cwd, config.paths.current);
  const diffDir = path.join(cwd, config.paths.diff);

  // Ensure diff directory exists
  await fs.ensureDir(diffDir);

  // Get all screenshots
  const baselines = await getScreenshots(baselineDir);
  const currents = await getScreenshots(currentDir);

  // Get all unique screenshot names
  const allNames = new Set([...baselines.keys(), ...currents.keys()]);

  // Get threshold from config
  const threshold = config.visualEngine.threshold;

  // Process each screenshot
  const results: ComparisonResult[] = [];
  
  for (const name of allNames) {
    const baselinePath = baselines.get(name) || null;
    const currentPath = currents.get(name) || null;
    const diffPath = path.join(diffDir, `${name}.png`);

    const result = await processComparison(
      name,
      baselinePath,
      currentPath,
      diffPath,
      threshold
    );

    results.push(result);
  }

  // Calculate summary
  const summary: VerificationSummary = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    new: results.filter(r => r.status === 'new').length,
    missing: results.filter(r => r.status === 'missing').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
    timestamp: new Date().toISOString(),
  };

  return summary;
}

/**
 * Copy images to report directory for self-contained report
 */
export async function copyImagesToReport(
  results: ComparisonResult[],
  reportDir: string
): Promise<void> {
  const imagesDir = path.join(reportDir, 'images');
  await fs.ensureDir(imagesDir);

  for (const result of results) {
    try {
      // Copy baseline
      if (result.baselinePath && fs.existsSync(result.baselinePath)) {
        const baselineDest = path.join(imagesDir, `${result.name}-baseline.png`);
        await fs.copy(result.baselinePath, baselineDest);
      }

      // Copy current
      if (result.currentPath && fs.existsSync(result.currentPath)) {
        const currentDest = path.join(imagesDir, `${result.name}-current.png`);
        await fs.copy(result.currentPath, currentDest);
      }

      // Copy diff
      if (result.diffPath && fs.existsSync(result.diffPath)) {
        const diffDest = path.join(imagesDir, `${result.name}-diff.png`);
        await fs.copy(result.diffPath, diffDest);
      }
    } catch (error) {
      console.error(`Failed to copy images for ${result.name}:`, error);
    }
  }
}
