/**
 * Main entry point for @testivai/witness package
 */

// Main API
import record from './api/record';

// Export types
export type { TestTarget } from './api/record';
export type { TestivAIConfig } from './types/config';
export type { CaptureMetadata } from './core/StateLogger';

// Named exports
export { record };
export { StateLogger } from './core/StateLogger';
export { loadConfig, getDefaultConfig } from './core/ConfigService';

// Default export - main API object
const testivai = {
  record,
};

export default testivai;
