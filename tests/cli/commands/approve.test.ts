import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { approveCommand } from '../../../src/cli/commands/approve';
import { createTestImage, saveTestImage } from '../../fixtures/createTestImages';

// Mock pixelmatch
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

// Mock readline for confirmation prompts
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((query, callback) => {
      // Auto-confirm for tests
      callback('y');
    }),
    close: jest.fn(),
  })),
}));

describe('approve command', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-approve-cmd-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    }) as any;

    // Setup default config
    const config = {
      artifactRoot: '.testivai/artifacts',
      paths: {
        baseline: '.testivai/artifacts/baselines',
        current: '.testivai/artifacts/current',
        diff: '.testivai/artifacts/diffs',
        reports: '.testivai/reports',
      },
      visualEngine: { type: 'pixelmatch', threshold: 0.001 },
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
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('single snapshot approval', () => {
    it('should approve a single snapshot', async () => {
      const image = createTestImage(100, 100, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');

      await approveCommand('test');

      expect(fs.existsSync('.testivai/artifacts/baselines/test.png')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully approved'));
    });

    it('should delete diff image', async () => {
      const image = createTestImage(100, 100, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');
      await saveTestImage(image, '.testivai/artifacts/diffs/test.png');

      await approveCommand('test');

      expect(fs.existsSync('.testivai/artifacts/diffs/test.png')).toBe(false);
    });

    it('should handle missing snapshot', async () => {
      await expect(approveCommand('nonexistent')).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('--all flag', () => {
    it('should approve all failed and new snapshots', async () => {
      // Create failed test (different baseline and current)
      const baseline = createTestImage(50, 50, [255, 0, 0]);
      const current = createTestImage(50, 50, [0, 255, 0]);
      await saveTestImage(baseline, '.testivai/artifacts/baselines/failed.png');
      await saveTestImage(current, '.testivai/artifacts/current/failed.png');

      // Create new test (no baseline)
      const newImg = createTestImage(50, 50, [0, 0, 255]);
      await saveTestImage(newImg, '.testivai/artifacts/current/new.png');

      await approveCommand('', { all: true });

      // Both should be approved
      expect(fs.existsSync('.testivai/artifacts/baselines/failed.png')).toBe(true);
      expect(fs.existsSync('.testivai/artifacts/baselines/new.png')).toBe(true);
      
      // Check console output
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Approved: 2'));
    });

    it('should show confirmation prompt', async () => {
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');

      await approveCommand('', { all: true });

      expect(readline.createInterface).toHaveBeenCalled();
    });

    it('should handle no snapshots to approve', async () => {
      // Create passing test
      const image = createTestImage(50, 50, [100, 100, 100]);
      await saveTestImage(image, '.testivai/artifacts/baselines/passed.png');
      await saveTestImage(image, '.testivai/artifacts/current/passed.png');

      await approveCommand('', { all: true });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No snapshots need approval'));
    });
  });
});
