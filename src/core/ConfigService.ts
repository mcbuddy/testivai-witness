import * as fs from 'fs-extra';
import * as path from 'path';
import { TestivAIConfig } from '../types/config';

/**
 * Default configuration used when testivai.config.json doesn't exist
 */
const DEFAULT_CONFIG: TestivAIConfig = {
  artifactRoot: '.testivai/artifacts',
  paths: {
    baseline: '.testivai/artifacts/baselines',
    current: '.testivai/artifacts/current',
    diff: '.testivai/artifacts/diffs',
    reports: '.testivai/reports',
  },
  visualEngine: {
    type: 'pixelmatch',
    threshold: 0.1,
    includeAA: true,
    alpha: 0.1,
    diffColor: [255, 0, 0],
  },
  environments: {
    'desktop-hd': {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    },
  },
};

/**
 * Validates the configuration object structure
 * @param config - Configuration object to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config: any): config is TestivAIConfig {
  // Check required top-level properties
  if (!config.artifactRoot || typeof config.artifactRoot !== 'string') {
    throw new Error('Invalid config: artifactRoot is required and must be a string');
  }

  if (!config.paths || typeof config.paths !== 'object') {
    throw new Error('Invalid config: paths is required and must be an object');
  }

  // Validate paths
  const requiredPaths = ['baseline', 'current', 'diff', 'reports'];
  for (const pathKey of requiredPaths) {
    if (!config.paths[pathKey] || typeof config.paths[pathKey] !== 'string') {
      throw new Error(`Invalid config: paths.${pathKey} is required and must be a string`);
    }
  }

  // Validate visualEngine
  if (!config.visualEngine || typeof config.visualEngine !== 'object') {
    throw new Error('Invalid config: visualEngine is required and must be an object');
  }

  if (config.visualEngine.type !== 'pixelmatch') {
    throw new Error('Invalid config: visualEngine.type must be "pixelmatch"');
  }

  if (typeof config.visualEngine.threshold !== 'number') {
    throw new Error('Invalid config: visualEngine.threshold is required and must be a number');
  }

  // Validate environments
  if (!config.environments || typeof config.environments !== 'object') {
    throw new Error('Invalid config: environments is required and must be an object');
  }

  const envKeys = Object.keys(config.environments);
  if (envKeys.length === 0) {
    throw new Error('Invalid config: at least one environment must be defined');
  }

  for (const envKey of envKeys) {
    const env = config.environments[envKey];
    if (typeof env.width !== 'number' || typeof env.height !== 'number') {
      throw new Error(`Invalid config: environment "${envKey}" must have width and height as numbers`);
    }
  }

  // Validate optional api field if present
  if (config.api) {
    if (typeof config.api !== 'object') {
      throw new Error('Invalid config: api must be an object');
    }
    if (typeof config.api.endpoint !== 'string' || typeof config.api.enabled !== 'boolean') {
      throw new Error('Invalid config: api.endpoint must be a string and api.enabled must be a boolean');
    }
  }

  return true;
}

/**
 * Loads and validates the TestivAI configuration
 * If testivai.config.json doesn't exist, returns the default configuration
 * @param configPath - Optional custom path to config file (defaults to testivai.config.json in cwd)
 * @returns Validated TestivAIConfig object
 * @throws Error if config file exists but is invalid
 */
export function loadConfig(configPath?: string): TestivAIConfig {
  const configFilePath = configPath || path.join(process.cwd(), 'testivai.config.json');

  // If config file doesn't exist, return default config
  if (!fs.existsSync(configFilePath)) {
    console.log('⚠️  No testivai.config.json found, using default configuration');
    return DEFAULT_CONFIG;
  }

  try {
    // Read and parse config file
    const configContent = fs.readFileSync(configFilePath, 'utf-8');
    
    // Remove comments from JSON (simple implementation for // style comments)
    const cleanedContent = configContent
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');
    
    const config = JSON.parse(cleanedContent);

    // Validate the configuration
    validateConfig(config);

    return config as TestivAIConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse testivai.config.json: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Gets the default configuration
 * @returns Default TestivAIConfig object
 */
export function getDefaultConfig(): TestivAIConfig {
  return { ...DEFAULT_CONFIG };
}
