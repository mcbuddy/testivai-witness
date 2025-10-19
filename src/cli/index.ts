#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { verifyCommand } from './commands/verify';
import { serveCommand } from './commands/serve';
import { approveCommand } from './commands/approve';

const program = new Command();

program
  .name('tsvai')
  .description('TestivAI Witness - Visual testing adapter for Playwright')
  .version('1.0.0');

/**
 * Command: init
 * Initializes the TestivAI configuration in the project
 */
program
  .command('init')
  .description('Initialize TestivAI configuration in your project')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      console.error('Failed to initialize TestivAI:', error);
      process.exit(1);
    }
  });

/**
 * Command: verify
 * Runs the visual verification process using Pixelmatch
 */
program
  .command('verify')
  .description('Verify current screenshots against baseline images')
  .action(async () => {
    try {
      await verifyCommand();
    } catch (error) {
      console.error('Verification failed:', error);
      process.exit(1);
    }
  });

/**
 * Command: serve
 * Starts a local server to view the TestivAI Insight Dashboard
 */
program
  .command('serve')
  .description('Start local server for TestivAI Insight Dashboard')
  .option('-p, --port <port>', 'Port number for the server', '3000')
  .action(async (options) => {
    try {
      await serveCommand(options);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

/**
 * Command: approve
 * Approves a specific visual change and updates the baseline
 */
program
  .command('approve [name]')
  .description('Approve visual changes and update baseline image')
  .option('--all', 'Approve all failed and new snapshots')
  .action(async (name: string | undefined, options) => {
    try {
      await approveCommand(name || '', options);
    } catch (error) {
      console.error('Approval failed:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
