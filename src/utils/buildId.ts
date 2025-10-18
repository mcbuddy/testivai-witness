import { generateUUID } from './uuid';

/**
 * Generate or retrieve a build ID for grouping test runs
 * Checks common CI environment variables first
 */
export function getBuildId(): string {
  // Check common CI environment variables
  const ciVars = [
    'CI_BUILD_ID',
    'BUILD_ID',
    'GITHUB_RUN_ID',
    'CIRCLE_BUILD_NUM',
    'TRAVIS_BUILD_ID',
    'GITLAB_CI_BUILD_ID',
    'JENKINS_BUILD_ID',
    'BUILDKITE_BUILD_ID',
    'DRONE_BUILD_NUMBER',
    'SEMAPHORE_BUILD_NUMBER',
    'AZURE_BUILD_ID',
  ];

  for (const varName of ciVars) {
    const value = process.env[varName];
    if (value) {
      return value;
    }
  }

  // Generate a unique build ID if not in CI
  return `local-${generateUUID()}`;
}
