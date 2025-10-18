import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import record, { clearConfigCache } from '../../src/api/record';
import { StateLogger } from '../../src/core/StateLogger';
import { Page } from '@playwright/test';

// Mock console methods
const originalConsoleError = console.error;

// Mock Playwright Page
const createMockPage = (url: string = 'https://example.com/test-page'): Page => {
  return {
    url: () => url,
    viewportSize: () => ({ width: 1920, height: 1080 }),
    screenshot: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue({
      innerHTML: jest.fn().mockResolvedValue('<body>Test content</body>'),
    }),
  } as any;
};

describe('record API', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-record-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    
    // Reset state
    StateLogger.reset();
    clearConfigCache();
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
    consoleErrorSpy.mockRestore();
  });

  describe('Configuration', () => {
    it('should throw error if TestivAI is not initialized', async () => {
      const mockPage = createMockPage();

      await record('test', mockPage);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('TestivAI is not initialized')
      );
    });

    it('should use cached config on subsequent calls', async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
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

      const mockPage = createMockPage();
      
      // First call - loads config
      await record('test1', mockPage);
      
      // Remove config file
      await fs.remove('testivai.config.json');
      
      // Second call - should use cached config
      await record('test2', mockPage);
      
      // Both should succeed
      const logger = StateLogger.getInstance();
      const captures = logger.getCaptures();
      expect(captures).toHaveLength(2);
    });
  });

  describe('Screenshot Capture', () => {
    beforeEach(async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
      const config = {
        artifactRoot: '.testivai/artifacts',
        paths: {
          baseline: '.testivai/artifacts/baselines',
          current: '.testivai/artifacts/current',
          diff: '.testivai/artifacts/diffs',
          reports: '.testivai/reports',
        },
        visualEngine: { type: 'pixelmatch', threshold: 0.1 },
        environments: { 
          'desktop-hd': { width: 1920, height: 1080 },
          'mobile': { width: 375, height: 667 },
        },
      };
      await fs.writeJson('testivai.config.json', config);
    });

    it('should capture screenshot with provided name', async () => {
      const mockPage = createMockPage();
      
      await record('homepage', mockPage);

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining('homepage.png'),
        fullPage: true,
      });

      const logger = StateLogger.getInstance();
      const captures = logger.getCaptures();
      expect(captures).toHaveLength(1);
      expect(captures[0].name).toBe('homepage');
      expect(captures[0].screenshotPath).toBe('.testivai/artifacts/current/homepage.png');
    });

    it('should generate name from URL if not provided', async () => {
      const mockPage = createMockPage('https://example.com/products/item-123');
      
      await record(undefined, mockPage);

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining('products-item-123.png'),
        fullPage: true,
      });

      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].name).toBe('products-item-123');
    });

    it('should handle root URL', async () => {
      const mockPage = createMockPage('https://example.com/');
      
      await record(undefined, mockPage);

      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].name).toBe('index');
    });

    it('should handle invalid URL', async () => {
      const mockPage = createMockPage();
      mockPage.url = () => 'invalid-url';
      
      await record(undefined, mockPage);

      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].name).toBe('unknown');
    });
  });

  describe('DOM Capture', () => {
    beforeEach(async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
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
    });

    it('should capture DOM snippet', async () => {
      const mockPage = createMockPage();
      
      await record('test', mockPage);

      expect(mockPage.locator).toHaveBeenCalledWith('body');
      
      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].domSnippet).toBe('<body>Test content</body>');
    });

    it('should handle DOM capture failure gracefully', async () => {
      const mockPage = createMockPage();
      mockPage.locator = jest.fn().mockReturnValue({
        innerHTML: jest.fn().mockRejectedValue(new Error('DOM error')),
      });
      
      await record('test', mockPage);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture DOM snippet')
      );
      
      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].domSnippet).toBe('<error>Failed to capture DOM</error>');
    });
  });

  describe('Environment Detection', () => {
    beforeEach(async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
      const config = {
        artifactRoot: '.testivai/artifacts',
        paths: {
          baseline: '.testivai/artifacts/baselines',
          current: '.testivai/artifacts/current',
          diff: '.testivai/artifacts/diffs',
          reports: '.testivai/reports',
        },
        visualEngine: { type: 'pixelmatch', threshold: 0.1 },
        environments: { 
          'desktop-hd': { width: 1920, height: 1080 },
          'mobile': { width: 375, height: 667 },
        },
      };
      await fs.writeJson('testivai.config.json', config);
    });

    it('should detect matching environment', async () => {
      const mockPage = createMockPage();
      mockPage.viewportSize = () => ({ width: 375, height: 667 });
      
      await record('test', mockPage);

      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].environment).toBe('mobile');
    });

    it('should handle non-matching viewport', async () => {
      const mockPage = createMockPage();
      mockPage.viewportSize = () => ({ width: 1024, height: 768 });
      
      await record('test', mockPage);

      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].environment).toBe('1024x768');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
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
    });

    it('should handle missing target', async () => {
      await record('test', undefined as any);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Target is required')
      );
      
      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].error).toBe('Target is required for record()');
    });

    it('should handle screenshot failure', async () => {
      const mockPage = createMockPage();
      mockPage.screenshot = jest.fn().mockRejectedValue(new Error('Screenshot failed'));
      
      await record('test', mockPage);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Screenshot failed')
      );
      
      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].error).toBe('Screenshot failed');
    });
  });

  describe('Target Types', () => {
    beforeEach(async () => {
      // Initialize TestivAI
      await fs.ensureDir('.testivai/artifacts/current');
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
    });

    it('should handle Frame target', async () => {
      const mockPage = createMockPage();
      const mockFrame = {
        page: jest.fn().mockResolvedValue(mockPage),
      } as any;
      
      await record('frame-test', mockFrame);

      expect(mockFrame.page).toHaveBeenCalled();
      expect(mockPage.screenshot).toHaveBeenCalled();
    });

    it('should handle ElementHandle target', async () => {
      const mockPage = createMockPage();
      const mockFrame = {
        page: jest.fn().mockResolvedValue(mockPage),
      };
      const mockElement = {
        ownerFrame: jest.fn().mockResolvedValue(mockFrame),
        screenshot: jest.fn().mockResolvedValue(undefined),
        innerHTML: jest.fn().mockResolvedValue('<div>Element content</div>'),
      } as any;
      
      await record('element-test', mockElement);

      expect(mockElement.ownerFrame).toHaveBeenCalled();
      expect(mockElement.screenshot).toHaveBeenCalled();
      
      const captures = StateLogger.getInstance().getCaptures();
      expect(captures[0].domSnippet).toBe('<div>Element content</div>');
    });
  });
});
