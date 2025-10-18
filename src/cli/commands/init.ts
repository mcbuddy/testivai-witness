import * as fs from 'fs-extra';
import * as path from 'path';
import { TestivAIConfig } from '../../types/config';

/**
 * Default TestivAI configuration
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
 * Generate config file content with all fields (including commented optional ones)
 */
function generateConfigContent(): string {
  const config = {
    artifactRoot: DEFAULT_CONFIG.artifactRoot,
    paths: DEFAULT_CONFIG.paths,
    visualEngine: DEFAULT_CONFIG.visualEngine,
    environments: DEFAULT_CONFIG.environments,
  };

  const configJson = JSON.stringify(config, null, 2);
  
  // Add commented API configuration at the end
  const lines = configJson.split('\n');
  lines.splice(lines.length - 1, 0, 
    '  // Optional: Python backend API integration',
    '  // "api": {',
    '  //   "endpoint": "http://localhost:8000/api",',
    '  //   "enabled": false',
    '  // }'
  );
  
  return lines.join('\n');
}

/**
 * Initialize TestivAI in the current project
 * Creates necessary directories and configuration file
 */
export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'testivai.config.json');

  console.log('🚀 Initializing TestivAI in your project...\n');

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.log('⚠️  TestivAI is already initialized in this project.');
    console.log(`   Config file found at: ${configPath}`);
    console.log('\n💡 If you want to reinitialize:');
    console.log('   1. Remove the .testivai directory');
    console.log('   2. Remove testivai.config.json');
    console.log('   3. Run "npx tsvai init" again\n');
    return;
  }

  try {
    // Create directory structure
    console.log('📁 Creating directory structure...');
    const directories = [
      '.testivai',
      '.testivai/artifacts',
      '.testivai/artifacts/baselines',
      '.testivai/artifacts/current',
      '.testivai/artifacts/diffs',
      '.testivai/reports',
    ];

    for (const dir of directories) {
      const dirPath = path.join(cwd, dir);
      
      if (fs.existsSync(dirPath)) {
        console.log(`   ⚠️  Directory already exists: ${dir}`);
        console.log('\n💡 To reinitialize, please:');
        console.log('   1. Remove all TestivAI directories manually');
        console.log('   2. Run "npx tsvai init" again\n');
        return;
      }
      
      await fs.ensureDir(dirPath);
      console.log(`   ✓ Created: ${dir}`);
    }

    // Generate config file with commented optional fields
    console.log('\n📝 Generating configuration file...');
    const configContent = generateConfigContent();
    await fs.writeFile(configPath, configContent, 'utf-8');
    console.log(`   ✓ Created: testivai.config.json`);

    // Success message
    console.log('\n✅ TestivAI initialization complete!\n');
    console.log('Next steps:');
    console.log('  1. Add testivai.record() calls to your Playwright tests');
    console.log('  2. Run your tests: npx playwright test');
    console.log('  3. Verify results: npx tsvai verify');
    console.log('  4. View dashboard: npx tsvai serve\n');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    throw error;
  }
}
