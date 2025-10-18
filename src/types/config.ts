/**
 * TestivAI Configuration Interface
 * Defines the structure for the testivai.config.json file
 */
export interface TestivAIConfig {
  /**
   * Root directory for all artifacts
   */
  artifactRoot: string;

  /**
   * Path configurations for baseline, current, and diff images
   */
  paths: {
    baseline: string;
    current: string;
    diff: string;
    reports: string;
  };

  /**
   * Visual comparison engine configuration
   */
  visualEngine: {
    type: 'pixelmatch';
    threshold: number;
    includeAA?: boolean;
    alpha?: number;
    diffColor?: [number, number, number];
  };

  /**
   * Environment configurations for different test scenarios
   */
  environments: {
    [key: string]: {
      width: number;
      height: number;
      deviceScaleFactor?: number;
    };
  };

  /**
   * Optional API configuration for Python backend integration
   */
  api?: {
    endpoint: string;
    enabled: boolean;
  };
}
