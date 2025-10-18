import { TestivAIConfig } from '../../src/types/config';

describe('TestivAIConfig Interface', () => {
  it('should accept a valid configuration object', () => {
    const validConfig: TestivAIConfig = {
      artifactRoot: '.testivai/artifacts',
      paths: {
        baseline: './testivai/baseline',
        current: './testivai/current',
        diff: './testivai/diff',
        reports: './testivai/reports',
      },
      visualEngine: {
        type: 'pixelmatch',
        threshold: 0.1,
        includeAA: true,
        alpha: 0.1,
        diffColor: [255, 0, 0],
      },
      environments: {
        desktop: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
        mobile: {
          width: 375,
          height: 667,
        },
      },
      api: {
        endpoint: 'http://localhost:8000/api',
        enabled: true,
      },
    };

    expect(validConfig).toBeDefined();
    expect(validConfig.paths.baseline).toBe('./testivai/baseline');
    expect(validConfig.visualEngine.type).toBe('pixelmatch');
    expect(validConfig.environments.desktop.width).toBe(1920);
  });

  it('should accept configuration without optional api field', () => {
    const configWithoutApi: TestivAIConfig = {
      artifactRoot: '.testivai/artifacts',
      paths: {
        baseline: './testivai/baseline',
        current: './testivai/current',
        diff: './testivai/diff',
        reports: './testivai/reports',
      },
      visualEngine: {
        type: 'pixelmatch',
        threshold: 0.1,
      },
      environments: {
        desktop: {
          width: 1920,
          height: 1080,
        },
      },
    };

    expect(configWithoutApi).toBeDefined();
    expect(configWithoutApi.api).toBeUndefined();
  });

  it('should support multiple environments', () => {
    const multiEnvConfig: TestivAIConfig = {
      artifactRoot: '.testivai/artifacts',
      paths: {
        baseline: './testivai/baseline',
        current: './testivai/current',
        diff: './testivai/diff',
        reports: './testivai/reports',
      },
      visualEngine: {
        type: 'pixelmatch',
        threshold: 0.1,
      },
      environments: {
        desktop: { width: 1920, height: 1080 },
        tablet: { width: 768, height: 1024 },
        mobile: { width: 375, height: 667 },
      },
    };

    expect(Object.keys(multiEnvConfig.environments)).toHaveLength(3);
    expect(multiEnvConfig.environments.tablet.width).toBe(768);
  });
});
