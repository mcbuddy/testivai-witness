import { getBuildId } from '../../src/utils/buildId';

describe('getBuildId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return CI_BUILD_ID if set', () => {
    process.env.CI_BUILD_ID = 'ci-123';
    expect(getBuildId()).toBe('ci-123');
  });

  it('should return GITHUB_RUN_ID if set', () => {
    process.env.GITHUB_RUN_ID = 'github-456';
    expect(getBuildId()).toBe('github-456');
  });

  it('should prioritize CI_BUILD_ID over other variables', () => {
    process.env.CI_BUILD_ID = 'ci-123';
    process.env.GITHUB_RUN_ID = 'github-456';
    expect(getBuildId()).toBe('ci-123');
  });

  it('should generate local build ID if no CI variables set', () => {
    // Clear all CI variables
    const ciVars = [
      'CI_BUILD_ID', 'BUILD_ID', 'GITHUB_RUN_ID', 'CIRCLE_BUILD_NUM',
      'TRAVIS_BUILD_ID', 'GITLAB_CI_BUILD_ID', 'JENKINS_BUILD_ID',
      'BUILDKITE_BUILD_ID', 'DRONE_BUILD_NUMBER', 'SEMAPHORE_BUILD_NUMBER',
      'AZURE_BUILD_ID',
    ];
    ciVars.forEach(v => delete process.env[v]);

    const buildId = getBuildId();
    expect(buildId).toMatch(/^local-[0-9a-f-]+$/);
  });

  it('should generate unique local build IDs', () => {
    const id1 = getBuildId();
    const id2 = getBuildId();
    expect(id1).not.toBe(id2);
  });
});
