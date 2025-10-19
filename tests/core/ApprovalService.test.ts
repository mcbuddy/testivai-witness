import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { approveBaseline, approveMultipleBaselines, getApprovableSnapshots } from '../../src/core/ApprovalService';
import { createTestImage, saveTestImage } from '../fixtures/createTestImages';

describe('ApprovalService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-approval-test-'));
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
      visualEngine: { type: 'pixelmatch', threshold: 0.1 },
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

  describe('approveBaseline', () => {
    it('should copy current to baseline', async () => {
      const image = createTestImage(100, 100, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');

      const result = await approveBaseline('test');

      expect(result.success).toBe(true);
      expect(result.snapshotName).toBe('test');
      expect(fs.existsSync('.testivai/artifacts/baselines/test.png')).toBe(true);
    });

    it('should delete diff image if it exists', async () => {
      const image = createTestImage(100, 100, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');
      await saveTestImage(image, '.testivai/artifacts/diffs/test.png');

      await approveBaseline('test');

      expect(fs.existsSync('.testivai/artifacts/diffs/test.png')).toBe(false);
    });

    it('should handle missing current screenshot', async () => {
      const result = await approveBaseline('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('FILE_NOT_FOUND');
      expect(result.message).toContain('not found');
    });

    it('should handle permission errors', async () => {
      const image = createTestImage(50, 50, [100, 100, 100]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');

      // Make baseline directory read-only
      const baselineDir = path.join(tempDir, '.testivai/artifacts/baselines');
      await fs.ensureDir(baselineDir);
      
      try {
        fs.chmodSync(baselineDir, 0o444);
        
        const result = await approveBaseline('test');

        expect(result.success).toBe(false);
        expect(result.error).toBe('PERMISSION_DENIED');
      } finally {
        // Restore permissions
        fs.chmodSync(baselineDir, 0o755);
      }
    });

    it('should create baseline directory if it does not exist', async () => {
      // Remove baseline directory
      await fs.remove('.testivai/artifacts/baselines');

      const image = createTestImage(100, 100, [0, 255, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');

      const result = await approveBaseline('test');

      expect(result.success).toBe(true);
      expect(fs.existsSync('.testivai/artifacts/baselines/test.png')).toBe(true);
    });
  });

  describe('getApprovableSnapshots', () => {
    it('should return list of current snapshots', async () => {
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test1.png');
      await saveTestImage(image, '.testivai/artifacts/current/test2.png');
      await saveTestImage(image, '.testivai/artifacts/current/test3.png');

      const snapshots = await getApprovableSnapshots();

      expect(snapshots).toHaveLength(3);
      expect(snapshots).toContain('test1');
      expect(snapshots).toContain('test2');
      expect(snapshots).toContain('test3');
    });

    it('should return empty array if directory does not exist', async () => {
      await fs.remove('.testivai/artifacts/current');

      const snapshots = await getApprovableSnapshots();

      expect(snapshots).toEqual([]);
    });

    it('should only return PNG files', async () => {
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test.png');
      await fs.writeFile('.testivai/artifacts/current/readme.txt', 'test');
      await fs.writeFile('.testivai/artifacts/current/data.json', '{}');

      const snapshots = await getApprovableSnapshots();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toBe('test');
    });
  });

  describe('approveMultipleBaselines', () => {
    it('should approve multiple snapshots', async () => {
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test1.png');
      await saveTestImage(image, '.testivai/artifacts/current/test2.png');
      await saveTestImage(image, '.testivai/artifacts/current/test3.png');

      const results = await approveMultipleBaselines(['test1', 'test2', 'test3']);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(fs.existsSync('.testivai/artifacts/baselines/test1.png')).toBe(true);
      expect(fs.existsSync('.testivai/artifacts/baselines/test2.png')).toBe(true);
      expect(fs.existsSync('.testivai/artifacts/baselines/test3.png')).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const image = createTestImage(50, 50, [255, 0, 0]);
      await saveTestImage(image, '.testivai/artifacts/current/test1.png');
      // test2 does not exist
      await saveTestImage(image, '.testivai/artifacts/current/test3.png');

      const results = await approveMultipleBaselines(['test1', 'test2', 'test3']);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });
});
