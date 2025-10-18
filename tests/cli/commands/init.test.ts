import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { initCommand } from '../../../src/cli/commands/init';

describe('init command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testivai-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Restore original directory and clean up
    process.chdir(originalCwd);
    fs.removeSync(tempDir);
  });

  it('should create all required directories', async () => {
    await initCommand();

    const expectedDirs = [
      '.testivai',
      '.testivai/artifacts',
      '.testivai/artifacts/baselines',
      '.testivai/artifacts/current',
      '.testivai/artifacts/diffs',
      '.testivai/reports',
    ];

    for (const dir of expectedDirs) {
      const dirPath = path.join(tempDir, dir);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    }
  });

  it('should create testivai.config.json with correct structure', async () => {
    await initCommand();

    const configPath = path.join(tempDir, 'testivai.config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, 'utf-8');
    expect(configContent).toContain('"artifactRoot"');
    expect(configContent).toContain('.testivai/artifacts');
    expect(configContent).toContain('"desktop-hd"');
    expect(configContent).toContain('"width": 1920');
    expect(configContent).toContain('"height": 1080');
  });

  it('should include commented API configuration in config file', async () => {
    await initCommand();

    const configPath = path.join(tempDir, 'testivai.config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');

    expect(configContent).toContain('// Optional: Python backend API integration');
    expect(configContent).toContain('// "api"');
    expect(configContent).toContain('"endpoint"');
    expect(configContent).toContain('"enabled"');
  });

  it('should not overwrite existing config file', async () => {
    // First initialization
    await initCommand();

    const configPath = path.join(tempDir, 'testivai.config.json');
    const originalContent = fs.readFileSync(configPath, 'utf-8');

    // Modify the config
    const modifiedConfig = originalContent.replace('1920', '1280');
    fs.writeFileSync(configPath, modifiedConfig, 'utf-8');

    // Try to initialize again
    await initCommand();

    // Config should not be overwritten
    const currentContent = fs.readFileSync(configPath, 'utf-8');
    expect(currentContent).toBe(modifiedConfig);
    expect(currentContent).toContain('1280');
  });

  it('should not create directories if they already exist', async () => {
    // Create one of the directories manually
    const existingDir = path.join(tempDir, '.testivai');
    fs.mkdirSync(existingDir);

    // Try to initialize
    await initCommand();

    // Should detect existing directory and not proceed
    const configPath = path.join(tempDir, 'testivai.config.json');
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it('should create valid JSON that can be parsed', async () => {
    await initCommand();

    const configPath = path.join(tempDir, 'testivai.config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');

    // Remove comments to parse
    const cleanedContent = configContent
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

    expect(() => JSON.parse(cleanedContent)).not.toThrow();

    const config = JSON.parse(cleanedContent);
    expect(config.artifactRoot).toBe('.testivai/artifacts');
    expect(config.paths.baseline).toBe('.testivai/artifacts/baselines');
    expect(config.visualEngine.type).toBe('pixelmatch');
    expect(config.environments['desktop-hd']).toBeDefined();
  });
});
