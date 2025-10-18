import { sendIngestion, writePayloadToFile } from '../../src/core/HttpSender';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Mock fetch
global.fetch = jest.fn();

describe('HttpSender', () => {
  let tempDir: string;
  let originalCwd: string;
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-http-test-'));
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
      api: {
        endpoint: 'http://localhost:8000/api/v1/ingest',
        enabled: true,
      },
    };
    fs.writeJsonSync('testivai.config.json', config);
    
    mockFetch.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
    delete process.env.TESTIVAI_KEY;
    delete process.env.TESTIVAI_API_URL;
  });

  describe('sendIngestion', () => {
    const mockPayload = {
      accountId: 'test-account',
      buildId: 'test-build',
      captures: [{ id: '1', name: 'test' }],
    };

    it('should send payload successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success' }),
      });

      const result = await sendIngestion(mockPayload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ingest',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer FREE-TIER-USER',
          }),
          body: JSON.stringify(mockPayload),
        })
      );
    });

    it('should use TESTIVAI_KEY if set', async () => {
      process.env.TESTIVAI_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await sendIngestion(mockPayload);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should use custom API URL if set', async () => {
      process.env.TESTIVAI_API_URL = 'https://api.testivai.com/ingest';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await sendIngestion(mockPayload);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.testivai.com/ingest',
        expect.any(Object)
      );
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message: 'Success' }),
        });

      const result = await sendIngestion(mockPayload, { retryDelay: 10 });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      });

      const result = await sendIngestion(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sendIngestion(mockPayload, { 
        maxRetries: 2, 
        retryDelay: 10 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout', async () => {
      let abortController: AbortController | null = null;
      mockFetch.mockImplementation((url, options) => {
        abortController = options.signal?.controller || null;
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new Error('AbortError: The operation was aborted'));
          });
        });
      });

      const resultPromise = sendIngestion(mockPayload, { 
        timeout: 100,
        maxRetries: 1,
      });

      // Wait a bit for the timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('The operation was aborted');
    }, 10000);

    it('should skip sending if API is disabled', async () => {
      const config = JSON.parse(fs.readFileSync('testivai.config.json', 'utf-8'));
      config.api.enabled = false;
      fs.writeJsonSync('testivai.config.json', config);

      const result = await sendIngestion(mockPayload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('API disabled');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('writePayloadToFile', () => {
    it('should write payload to reports directory', async () => {
      const payload = { test: 'data', captures: [] };
      
      await writePayloadToFile(payload, 'test-payload.json');

      const filePath = path.join(tempDir, '.testivai/reports/test-payload.json');
      expect(fs.existsSync(filePath)).toBe(true);
      
      const content = fs.readJsonSync(filePath);
      expect(content).toEqual(payload);
    });

    it('should generate filename if not provided', async () => {
      const payload = { test: 'data' };
      
      await writePayloadToFile(payload);

      const files = fs.readdirSync(path.join(tempDir, '.testivai/reports'));
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^testivai-payload-\d+\.json$/);
    });

    it('should handle write errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Make reports directory read-only
      const reportsDir = path.join(tempDir, '.testivai/reports');
      fs.ensureDirSync(reportsDir);
      
      try {
        fs.chmodSync(reportsDir, 0o444);
        await writePayloadToFile({ test: 'data' });

        expect(consoleSpy).toHaveBeenCalled();
        const calls = consoleSpy.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][0]).toBe('Failed to write payload to file:');
        expect(calls[0][1]).toBeDefined();
        expect(calls[0][1].toString()).toContain('permission denied');
      } finally {
        // Always restore permissions
        fs.chmodSync(reportsDir, 0o755);
        consoleSpy.mockRestore();
      }
    });
  });
});
