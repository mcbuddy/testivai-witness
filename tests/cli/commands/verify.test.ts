import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { verifyCommand } from '../../../src/cli/commands/verify';
import { createTestImage, saveTestImage } from '../../fixtures/createTestImages';

// Mock pixelmatch to avoid ES module issues in Jest
jest.mock('pixelmatch', () => {
  return jest.fn((img1, img2, output, width, height, options) => {
    let diffCount = 0;
    for (let i = 0; i < img1.length; i += 4) {
      if (img1[i] !== img2[i] || img1[i+1] !== img2[i+1] || img1[i+2] !== img2[i+2]) {
        diffCount++;
        if (output) {
          output[i] = 255;
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

describe('verify command', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-verify-cmd-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
    consoleSpy.mockRestore();
  });

  it('should run verification and generate report', async () => {
    // Create test images
    const image = createTestImage(100, 100, [255, 0, 0]);
    await saveTestImage(image, '.testivai/artifacts/baselines/test.png');
    await saveTestImage(image, '.testivai/artifacts/current/test.png');

    await verifyCommand();

    // Check that report was generated
    const reportPath = path.join(tempDir, '.testivai/reports/index.html');
    expect(fs.existsSync(reportPath)).toBe(true);

    // Check that images were copied
    expect(fs.existsSync(path.join(tempDir, '.testivai/reports/images/test-baseline.png'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.testivai/reports/images/test-current.png'))).toBe(true);

    // Check console output
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting visual verification'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Report generated successfully'));
  });

  it('should display summary statistics', async () => {
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

    await verifyCommand();

    // Check summary output
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total:   3'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Passed: 1'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: 1'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('New:    1'));
  });

  it('should show warnings for failed tests', async () => {
    const baseline = createTestImage(50, 50, [255, 0, 0]);
    const current = createTestImage(50, 50, [0, 255, 0]);
    await saveTestImage(baseline, '.testivai/artifacts/baselines/failed.png');
    await saveTestImage(current, '.testivai/artifacts/current/failed.png');

    await verifyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('screenshot(s) have visual differences'));
  });

  it('should show warnings for missing tests', async () => {
    const image = createTestImage(50, 50, [255, 0, 0]);
    await saveTestImage(image, '.testivai/artifacts/baselines/missing.png');

    await verifyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('screenshot(s) are missing'));
  });

  it('should show info for new tests', async () => {
    const image = createTestImage(50, 50, [0, 0, 255]);
    await saveTestImage(image, '.testivai/artifacts/current/new.png');

    await verifyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('new screenshot(s) detected'));
  });

  it('should handle empty directories', async () => {
    await verifyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total:   0'));
    
    const reportPath = path.join(tempDir, '.testivai/reports/index.html');
    expect(fs.existsSync(reportPath)).toBe(true);
  });

  it('should generate valid HTML report', async () => {
    const image = createTestImage(100, 100, [255, 0, 0]);
    await saveTestImage(image, '.testivai/artifacts/baselines/test.png');
    await saveTestImage(image, '.testivai/artifacts/current/test.png');

    await verifyCommand();

    const reportPath = path.join(tempDir, '.testivai/reports/index.html');
    const html = await fs.readFile(reportPath, 'utf-8');

    // Check for key HTML elements
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('TestivAI Insight Dashboard');
    expect(html).toContain('status-badge');
    expect(html).toContain('comparison-card');
  });
});
