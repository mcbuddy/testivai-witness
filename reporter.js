/**
 * Reporter entry point for Playwright
 * This file is in the package root to allow:
 * reporter: ['@testivai/witness/reporter']
 */
module.exports = require('./dist/reporter/WitnessReporter').default;
