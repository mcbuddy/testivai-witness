import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, getDefaultConfig } from '../../src/core/ConfigService';
import { TestivAIConfig } from '../../src/types/config';

describe('ConfigService', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-config-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
  });

  describe('loadConfig', () => {
    it('should return default config when testivai.config.json does not exist', () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.artifactRoot).toBe('.testivai/artifacts');
      expect(config.paths.baseline).toBe('.testivai/artifacts/baselines');
      expect(config.visualEngine.type).toBe('pixelmatch');
      expect(config.environments['desktop-hd']).toBeDefined();
    });

    it('should load and parse valid config file', () => {
      const validConfig: TestivAIConfig = {
        artifactRoot: '.custom/artifacts',
        paths: {
          baseline: '.custom/baseline',
          current: '.custom/current',
          diff: '.custom/diff',
          reports: '.custom/reports',
        },
        visualEngine: {
          type: 'pixelmatch',
          threshold: 0.2,
        },
        environments: {
          mobile: {
            width: 375,
            height: 667,
          },
        },
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, validConfig, { spaces: 2 });

      const loadedConfig = loadConfig();

      expect(loadedConfig.artifactRoot).toBe('.custom/artifacts');
      expect(loadedConfig.paths.baseline).toBe('.custom/baseline');
      expect(loadedConfig.visualEngine.threshold).toBe(0.2);
      expect(loadedConfig.environments.mobile.width).toBe(375);
    });

    it('should load config with optional API field', () => {
      const configWithApi: TestivAIConfig = {
        artifactRoot: '.testivai/artifacts',
        paths: {
          baseline: '.testivai/baseline',
          current: '.testivai/current',
          diff: '.testivai/diff',
          reports: '.testivai/reports',
        },
        visualEngine: {
          type: 'pixelmatch',
          threshold: 0.1,
        },
        environments: {
          desktop: { width: 1920, height: 1080 },
        },
        api: {
          endpoint: 'http://localhost:8000/api',
          enabled: true,
        },
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, configWithApi, { spaces: 2 });

      const loadedConfig = loadConfig();

      expect(loadedConfig.api).toBeDefined();
      expect(loadedConfig.api?.endpoint).toBe('http://localhost:8000/api');
      expect(loadedConfig.api?.enabled).toBe(true);
    });

    it('should handle config files with comments', () => {
      const configWithComments = `{
  "artifactRoot": ".testivai/artifacts",
  "paths": {
    "baseline": ".testivai/artifacts/baselines",
    "current": ".testivai/artifacts/current",
    "diff": ".testivai/artifacts/diffs",
    "reports": ".testivai/reports"
  },
  "visualEngine": {
    "type": "pixelmatch",
    "threshold": 0.1
  },
  "environments": {
    "desktop-hd": {
      "width": 1920,
      "height": 1080
    }
  }
  // Optional: Python backend API integration
  // "api": {
  //   "endpoint": "http://localhost:8000/api",
  //   "enabled": false
  // }
}`;

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeFileSync(configPath, configWithComments, 'utf-8');

      expect(() => loadConfig()).not.toThrow();
      const config = loadConfig();
      expect(config.artifactRoot).toBe('.testivai/artifacts');
    });

    it('should throw error for invalid JSON', () => {
      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeFileSync(configPath, '{ invalid json }', 'utf-8');

      expect(() => loadConfig()).toThrow('Failed to parse testivai.config.json');
    });

    it('should throw error when artifactRoot is missing', () => {
      const invalidConfig = {
        paths: {
          baseline: '.testivai/baseline',
          current: '.testivai/current',
          diff: '.testivai/diff',
          reports: '.testivai/reports',
        },
        visualEngine: { type: 'pixelmatch', threshold: 0.1 },
        environments: { desktop: { width: 1920, height: 1080 } },
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, invalidConfig);

      expect(() => loadConfig()).toThrow('artifactRoot is required');
    });

    it('should throw error when paths are missing', () => {
      const invalidConfig = {
        artifactRoot: '.testivai/artifacts',
        visualEngine: { type: 'pixelmatch', threshold: 0.1 },
        environments: { desktop: { width: 1920, height: 1080 } },
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, invalidConfig);

      expect(() => loadConfig()).toThrow('paths is required');
    });

    it('should throw error when visualEngine type is not pixelmatch', () => {
      const invalidConfig = {
        artifactRoot: '.testivai/artifacts',
        paths: {
          baseline: '.testivai/baseline',
          current: '.testivai/current',
          diff: '.testivai/diff',
          reports: '.testivai/reports',
        },
        visualEngine: { type: 'invalid', threshold: 0.1 },
        environments: { desktop: { width: 1920, height: 1080 } },
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, invalidConfig);

      expect(() => loadConfig()).toThrow('visualEngine.type must be "pixelmatch"');
    });

    it('should throw error when no environments are defined', () => {
      const invalidConfig = {
        artifactRoot: '.testivai/artifacts',
        paths: {
          baseline: '.testivai/baseline',
          current: '.testivai/current',
          diff: '.testivai/diff',
          reports: '.testivai/reports',
        },
        visualEngine: { type: 'pixelmatch', threshold: 0.1 },
        environments: {},
      };

      const configPath = path.join(tempDir, 'testivai.config.json');
      fs.writeJsonSync(configPath, invalidConfig);

      expect(() => loadConfig()).toThrow('at least one environment must be defined');
    });

    it('should load config from custom path', () => {
      const customConfig: TestivAIConfig = {
        artifactRoot: '.custom/artifacts',
        paths: {
          baseline: '.custom/baseline',
          current: '.custom/current',
          diff: '.custom/diff',
          reports: '.custom/reports',
        },
        visualEngine: { type: 'pixelmatch', threshold: 0.15 },
        environments: { tablet: { width: 768, height: 1024 } },
      };

      const customPath = path.join(tempDir, 'custom.config.json');
      fs.writeJsonSync(customPath, customConfig, { spaces: 2 });

      const loadedConfig = loadConfig(customPath);

      expect(loadedConfig.artifactRoot).toBe('.custom/artifacts');
      expect(loadedConfig.visualEngine.threshold).toBe(0.15);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return a valid default configuration', () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.artifactRoot).toBe('.testivai/artifacts');
      expect(defaultConfig.paths.baseline).toBe('.testivai/artifacts/baselines');
      expect(defaultConfig.paths.current).toBe('.testivai/artifacts/current');
      expect(defaultConfig.paths.diff).toBe('.testivai/artifacts/diffs');
      expect(defaultConfig.paths.reports).toBe('.testivai/reports');
      expect(defaultConfig.visualEngine.type).toBe('pixelmatch');
      expect(defaultConfig.visualEngine.threshold).toBe(0.1);
      expect(defaultConfig.environments['desktop-hd']).toEqual({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
    });

    it('should return a new object each time (not a reference)', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
