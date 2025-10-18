import WitnessReporter from '../../src/reporter/WitnessReporter';
import { StateLogger } from '../../src/core/StateLogger';
import * as HttpSender from '../../src/core/HttpSender';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

// Mock dependencies
jest.mock('../../src/core/HttpSender');

describe('WitnessReporter', () => {
  let tempDir: string;
  let originalCwd: string;
  let reporter: WitnessReporter;
  const mockSendIngestion = HttpSender.sendIngestion as jest.Mock;
  const mockWritePayloadToFile = HttpSender.writePayloadToFile as jest.Mock;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-reporter-test-'));
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
        enabled: true 
      },
    };
    fs.writeJsonSync('testivai.config.json', config);
    
    // Reset mocks
    jest.clearAllMocks();
    StateLogger.reset();
    
    // Setup default mock responses
    mockSendIngestion.mockResolvedValue({ success: true });
    mockWritePayloadToFile.mockResolvedValue(undefined);
    
    reporter = new WitnessReporter();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
    delete process.env.TESTIVAI_KEY;
    delete process.env.CI_BUILD_ID;
    delete process.env.TESTIVAI_QUIET;
  });

  const createMockConfig = (): FullConfig => ({
    projects: [],
    workers: 1,
  } as any);

  const createMockSuite = (): Suite => ({
    suites: [],
    tests: [],
  } as any);

  const createMockTest = (file: string): TestCase => ({
    location: { file, line: 1, column: 1 },
  } as any);

  const createMockResult = (): FullResult => ({
    status: 'passed',
  } as any);

  describe('onBegin', () => {
    it('should initialize reporter state', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      reporter.onBegin(createMockConfig(), createMockSuite());
      
      expect(consoleSpy).toHaveBeenCalledWith('TestivAI: Starting visual capture collection...');
      consoleSpy.mockRestore();
    });

    it('should be quiet when quiet option is set', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      reporter = new WitnessReporter({ quiet: true });
      
      reporter.onBegin(createMockConfig(), createMockSuite());
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('onTestBegin', () => {
    it('should track test files', () => {
      reporter.onBegin(createMockConfig(), createMockSuite());
      
      reporter.onTestBegin(createMockTest('tests/example1.spec.ts'));
      reporter.onTestBegin(createMockTest('tests/example2.spec.ts'));
      reporter.onTestBegin(createMockTest('tests/example1.spec.ts')); // Duplicate
      
      // We can't directly check private testFiles, but we'll verify in onEnd
    });
  });

  describe('onEnd', () => {
    it('should send captures when available', async () => {
      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test-capture',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      }, 'tests/example.spec.ts');

      reporter.onBegin(createMockConfig(), createMockSuite());
      reporter.onTestBegin(createMockTest('tests/example.spec.ts'));
      await reporter.onEnd(createMockResult());

      expect(mockWritePayloadToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'FREE-TIER-USER',
          buildId: expect.stringMatching(/^local-/),
          timestamp: expect.any(String),
          captures: expect.arrayContaining([
            expect.objectContaining({
              name: 'test-capture',
            }),
          ]),
          testFiles: ['tests/example.spec.ts'],
        }),
        'last-run.json'
      );

      expect(mockSendIngestion).toHaveBeenCalledWith(
        expect.objectContaining({
          captures: expect.arrayContaining([
            expect.objectContaining({
              name: 'test-capture',
            }),
          ]),
        })
      );
    });

    it('should use TESTIVAI_KEY if set', async () => {
      process.env.TESTIVAI_KEY = 'test-api-key';
      
      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      });

      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(mockWritePayloadToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'test-api-key',
        }),
        'last-run.json'
      );
    });

    it('should use CI_BUILD_ID if set', async () => {
      process.env.CI_BUILD_ID = 'ci-build-123';
      
      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      });

      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(mockWritePayloadToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          buildId: 'ci-build-123',
        }),
        'last-run.json'
      );
    });

    it('should skip sending when no captures', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(consoleSpy).toHaveBeenCalledWith('TestivAI: No captures to send');
      expect(mockSendIngestion).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should skip API when disabled in config', async () => {
      const config = JSON.parse(fs.readFileSync('testivai.config.json', 'utf-8'));
      config.api.enabled = false;
      fs.writeJsonSync('testivai.config.json', config);

      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      });

      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(mockWritePayloadToFile).toHaveBeenCalled();
      expect(mockSendIngestion).not.toHaveBeenCalled();
    });

    it('should clear captures after sending', async () => {
      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      });

      expect(logger.size()).toBe(1);

      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(logger.size()).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockSendIngestion.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<div>Test</div>',
      });

      reporter.onBegin(createMockConfig(), createMockSuite());
      await reporter.onEnd(createMockResult());

      expect(consoleSpy).toHaveBeenCalledWith(
        'TestivAI Reporter error:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should print summary when not quiet', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const logger = StateLogger.getInstance();
      logger.logCapture({
        name: 'test1',
        screenshotPath: 'test1.png',
        domSnippet: '<div>Test1</div>',
      }, 'tests/example1.spec.ts');
      
      logger.logCapture({
        name: 'test2',
        screenshotPath: 'test2.png',
        domSnippet: '<div>Test2</div>',
      }, 'tests/example2.spec.ts');

      reporter.onBegin(createMockConfig(), createMockSuite());
      reporter.onTestBegin(createMockTest('tests/example1.spec.ts'));
      reporter.onTestBegin(createMockTest('tests/example2.spec.ts'));
      await reporter.onEnd(createMockResult());

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Completed in'));
      expect(consoleSpy).toHaveBeenCalledWith('  - Captures: 2');
      expect(consoleSpy).toHaveBeenCalledWith('  - Test files: 2');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Build ID:'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('printsToStdio', () => {
    it('should return true by default', () => {
      expect(reporter.printsToStdio()).toBe(true);
    });

    it('should return false when quiet', () => {
      reporter = new WitnessReporter({ quiet: true });
      expect(reporter.printsToStdio()).toBe(false);
    });
  });
});
