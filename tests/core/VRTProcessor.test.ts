import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { runVerification, copyImagesToReport } from '../../src/core/VRTProcessor';
import { createTestImage, saveTestImage, createImageWithRectangle } from '../fixtures/createTestImages';

// Mock pixelmatch to avoid ES module issues in Jest
jest.mock('pixelmatch', () => {
  return jest.fn((img1, img2, output, width, height, options) => {
    // Simple mock: count different pixels
    let diffCount = 0;
    for (let i = 0; i < img1.length; i += 4) {
      if (img1[i] !== img2[i] || img1[i+1] !== img2[i+1] || img1[i+2] !== img2[i+2]) {
        diffCount++;
        if (output) {
          output[i] = 255;     // Red
          output[i+1] = 0;
          output[i+2] = 0;
          output[i+3] = 255;
        }
      } else if (output) {
        output[i] = img1[i];
        output[i+1] = img1[i+1];
        output[i+2] = img1[i+2];
        output[i+3] = img1[i+3];
      }
    }
    return diffCount;
  });
});

describe('VRTProcessor', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-vrt-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Setup default config
    const config = {
      artifactRoot: '.testivai/artifacts',
      paths: {
        baseline: '.testivai/artifacts/baselines',
        current: '.testivai/artifacts/current',
        diff: '.testivai/artifacts/diffs',
        reports: '.testivai/reports',
      },
      visualEngine: {
        type: 'pixelmatch',
        threshold: 0.001,
        includeAA: true,
        alpha: 0.1,
        diffColor: [255, 0, 0],
      },
      environments: { 'desktop-hd': { width: 1920, height: 1080 } },
    };
    await fs.writeJson('testivai.config.json', config);

    // Create directories
    await fs.ensureDir('.testivai/artifacts/baselines');
    await fs.ensureDir('.testivai/artifacts/current');
    await fs.ensureDir('.testivai/artifacts/diffs');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
  });

  describe('runVerification', () => {
    it('should detect identical images as passed', async () => {
      // Create identical baseline and current images
      const image = createTestImage(100, 100, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/baselines/test1.png');
      await saveTestImage(image, '.testivai/artifacts/current/test1.png');

      const summary = await runVerification();

      expect(summary.total).toBe(1);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.results[0].status).toBe('passed');
      expect(summary.results[0].diffPixelRatio).toBe(0);
    });

    it('should detect different images as failed', async () => {
      // Create different images
      const baseline = createTestImage(100, 100, [255, 0, 0]); // Red
      const current = createTestImage(100, 100, [0, 0, 255]);  // Blue
      
      await saveTestImage(baseline, '.testivai/artifacts/baselines/test2.png');
      await saveTestImage(current, '.testivai/artifacts/current/test2.png');

      const summary = await runVerification();

      expect(summary.total).toBe(1);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(1);
      expect(summary.results[0].status).toBe('failed');
      expect(summary.results[0].diffPixelRatio).toBeGreaterThan(0.001);
    });

    it('should detect new screenshots without baseline', async () => {
      // Create only current image (no baseline)
      const image = createTestImage(100, 100, [0, 255, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/new-test.png');

      const summary = await runVerification();

      expect(summary.total).toBe(1);
      expect(summary.new).toBe(1);
      expect(summary.results[0].status).toBe('new');
      expect(summary.results[0].name).toBe('new-test');
    });

    it('should detect missing current screenshots', async () => {
      // Create only baseline image (no current)
      const image = createTestImage(100, 100, [255, 255, 0]);
      await saveTestImage(image, '.testivai/artifacts/baselines/missing-test.png');

      const summary = await runVerification();

      expect(summary.total).toBe(1);
      expect(summary.missing).toBe(1);
      expect(summary.results[0].status).toBe('missing');
      expect(summary.results[0].error).toContain('missing');
    });

    it('should handle multiple screenshots', async () => {
      // Create passed test
      const passed = createTestImage(50, 50, [100, 100, 100]);
      await saveTestImage(passed, '.testivai/artifacts/baselines/passed.png');
      await saveTestImage(passed, '.testivai/artifacts/current/passed.png');

      // Create failed test
      const baseline = createTestImage(50, 50, [255, 0, 0]);
      const current = createTestImage(50, 50, [0, 255, 0]);
      await saveTestImage(baseline, '.testivai/artifacts/baselines/failed.png');
      await saveTestImage(current, '.testivai/artifacts/current/failed.png');

      // Create new test
      const newImg = createTestImage(50, 50, [0, 0, 255]);
      await saveTestImage(newImg, '.testivai/artifacts/current/new.png');

      const summary = await runVerification();

      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.new).toBe(1);
    });

    it('should create diff images', async () => {
      const baseline = createTestImage(100, 100, [255, 0, 0]);
      const current = createTestImage(100, 100, [0, 0, 255]);
      
      await saveTestImage(baseline, '.testivai/artifacts/baselines/diff-test.png');
      await saveTestImage(current, '.testivai/artifacts/current/diff-test.png');

      await runVerification();

      const diffPath = path.join(tempDir, '.testivai/artifacts/diffs/diff-test.png');
      expect(fs.existsSync(diffPath)).toBe(true);
    });

    it('should handle dimension mismatch', async () => {
      const baseline = createTestImage(100, 100, [255, 0, 0]);
      const current = createTestImage(150, 150, [255, 0, 0]);
      
      await saveTestImage(baseline, '.testivai/artifacts/baselines/size-test.png');
      await saveTestImage(current, '.testivai/artifacts/current/size-test.png');

      const summary = await runVerification();

      expect(summary.total).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.results[0].status).toBe('error');
      expect(summary.results[0].error).toContain('dimensions mismatch');
    });

    it('should respect threshold from config', async () => {
      // Create images with small difference
      const baseline = createImageWithRectangle(100, 100, [255, 255, 255], [0, 0, 0], 10, 10, 2, 2);
      const current = createImageWithRectangle(100, 100, [255, 255, 255], [0, 0, 0], 10, 10, 3, 3);
      
      await saveTestImage(baseline, '.testivai/artifacts/baselines/threshold-test.png');
      await saveTestImage(current, '.testivai/artifacts/current/threshold-test.png');

      const summary = await runVerification();

      // Small difference should be within threshold
      const result = summary.results[0];
      expect(result.diffPixelRatio).toBeLessThan(0.01); // Less than 1%
    });

    it('should handle empty directories', async () => {
      const summary = await runVerification();

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.new).toBe(0);
    });
  });

  describe('copyImagesToReport', () => {
    it('should copy images to report directory', async () => {
      // Create test images
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/baselines/copy-test.png');
      await saveTestImage(image, '.testivai/artifacts/current/copy-test.png');

      const summary = await runVerification();
      const reportDir = path.join(tempDir, '.testivai/reports');
      
      await copyImagesToReport(summary.results, reportDir);

      // Check if images were copied
      expect(fs.existsSync(path.join(reportDir, 'images/copy-test-baseline.png'))).toBe(true);
      expect(fs.existsSync(path.join(reportDir, 'images/copy-test-current.png'))).toBe(true);
      expect(fs.existsSync(path.join(reportDir, 'images/copy-test-diff.png'))).toBe(true);
    });

    it('should handle missing images gracefully', async () => {
      const results = [{
        name: 'nonexistent',
        status: 'new' as const,
        diffPixelRatio: 0,
        diffPixelCount: 0,
        totalPixels: 0,
        threshold: 0.001,
        currentPath: '/nonexistent/path.png',
      }];

      const reportDir = path.join(tempDir, '.testivai/reports');
      
      // Should not throw
      await expect(copyImagesToReport(results, reportDir)).resolves.not.toThrow();
    });
  });
});
