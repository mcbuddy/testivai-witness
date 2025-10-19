import * as readline from 'readline';
import { approveBaseline, approveMultipleBaselines, getApprovableSnapshots } from '../../core/ApprovalService';
import { runVerification } from '../../core/VRTProcessor';

/**
 * Prompt user for confirmation
 */
async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Handler for the 'tsvai approve' command
 * Approves visual changes and updates baseline images
 */
export async function approveCommand(
  name: string,
  options: { all?: boolean } = {}
): Promise<void> {
  try {
    // Handle --all flag
    if (options.all) {
      console.log('🔍 Finding snapshots to approve...\n');
      
      // Get current verification status
      const summary = await runVerification();
      const approvableSnapshots = summary.results
        .filter(r => r.status === 'failed' || r.status === 'new')
        .map(r => r.name);
      
      if (approvableSnapshots.length === 0) {
        console.log('✅ No snapshots need approval.');
        console.log('   All tests are passing!');
        return;
      }
      
      console.log('📋 Snapshots to approve:');
      approvableSnapshots.forEach((name, index) => {
        const result = summary.results.find(r => r.name === name);
        const status = result?.status === 'new' ? '(new)' : '(failed)';
        console.log(`   ${index + 1}. ${name} ${status}`);
      });
      console.log('');
      
      // Confirm bulk approval
      const confirmed = await confirmAction(
        `⚠️  This will approve ${approvableSnapshots.length} snapshot(s). Continue?`
      );
      
      if (!confirmed) {
        console.log('❌ Approval cancelled.');
        return;
      }
      
      console.log('\n📝 Approving snapshots...\n');
      
      // Approve all
      const results = await approveMultipleBaselines(approvableSnapshots);
      
      // Display results
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
          console.log(`✓ ${result.snapshotName}`);
        } else {
          failureCount++;
          console.error(`✗ ${result.snapshotName}: ${result.message}`);
        }
      });
      
      console.log('');
      console.log(`✅ Approved: ${successCount}`);
      if (failureCount > 0) {
        console.log(`❌ Failed: ${failureCount}`);
      }
      console.log('');
      console.log('💡 Run "npx tsvai verify" to see updated results.');
      
      return;
    }
    
    // Handle single snapshot approval
    if (!name) {
      console.error('❌ Error: Snapshot name is required.');
      console.error('');
      console.error('Usage:');
      console.error('  npx tsvai approve <name>     Approve a specific snapshot');
      console.error('  npx tsvai approve --all      Approve all failed/new snapshots');
      process.exit(1);
    }
    
    console.log(`📝 Approving baseline for: ${name}\n`);
    
    const result = await approveBaseline(name);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log('');
      console.log('💡 Run "npx tsvai verify" to see updated results.');
    } else {
      console.error(`❌ ${result.message}`);
      
      if (result.error === 'FILE_NOT_FOUND') {
        console.error('');
        console.error('Please check:');
        console.error('  1. The snapshot name is correct');
        console.error('  2. Tests have been run (npx playwright test)');
        console.error('  3. Current screenshots exist');
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Approval failed:', error);
    console.error('\nPlease check:');
    console.error('  1. TestivAI is initialized (run "npx tsvai init")');
    console.error('  2. Screenshots exist');
    console.error('  3. File permissions are correct');
    process.exit(1);
  }
}
