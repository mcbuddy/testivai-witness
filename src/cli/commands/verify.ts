import * as path from 'path';
import { loadConfig } from '../../core/ConfigService';
import { runVerification, copyImagesToReport } from '../../core/VRTProcessor';
import { writeHTMLReport } from '../../core/ReportGenerator';

/**
 * Handler for the 'tsvai verify' command
 * Runs visual regression testing and generates the dashboard report
 */
export async function verifyCommand(): Promise<void> {
  try {
    console.log('🔍 TestivAI: Starting visual verification...\n');

    // Load configuration
    const config = loadConfig();
    const cwd = process.cwd();

    // Run verification
    console.log('📊 Comparing screenshots...');
    const summary = await runVerification();

    // Display summary
    console.log('\n📈 Verification Summary:');
    console.log(`   Total:   ${summary.total}`);
    if (summary.passed > 0) console.log(`   ✓ Passed: ${summary.passed}`);
    if (summary.failed > 0) console.log(`   ⚠️  Diff Detected: ${summary.failed}`);
    if (summary.new > 0) console.log(`   ➕ New:    ${summary.new}`);
    if (summary.missing > 0) console.log(`   ⚠️  Missing: ${summary.missing}`);
    if (summary.errors > 0) console.log(`   ❌ Errors: ${summary.errors}`);

    // Generate report
    console.log('\n📝 Generating dashboard report...');
    const reportDir = path.join(cwd, config.paths.reports);
    const reportPath = path.join(reportDir, 'index.html');

    // Copy images to report directory
    await copyImagesToReport(summary.results, reportDir);

    // Write HTML report
    await writeHTMLReport(summary, reportPath);

    console.log(`\n✅ Report generated successfully!`);
    console.log(`   📁 Location: ${path.relative(cwd, reportPath)}`);
    console.log(`\n💡 Open the report in your browser to review the results.`);
    console.log(`   You can approve changes directly from the dashboard.`);

    // Show warnings for missing or failed tests
    if (summary.missing > 0) {
      console.log(`\n⚠️  Warning: ${summary.missing} screenshot(s) are missing.`);
      console.log('   These tests may have been intentionally deleted.');
      console.log('   Review the dashboard to confirm.');
    }

    if (summary.failed > 0) {
      console.log(`\n⚠️  ${summary.failed} screenshot(s) have visual differences detected.`);
      console.log('   Review the dashboard and approve changes if they are intentional.');
    }

    if (summary.new > 0) {
      console.log(`\n➕ ${summary.new} new screenshot(s) detected.`);
      console.log('   These will be auto-approved as baselines on first run.');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    console.error('\nPlease check:');
    console.error('  1. TestivAI is initialized (run "npx tsvai init")');
    console.error('  2. Screenshots exist in the current directory');
    console.error('  3. File permissions are correct');
    process.exit(1);
  }
}
