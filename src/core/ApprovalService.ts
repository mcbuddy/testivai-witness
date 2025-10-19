import * as fs from 'fs-extra';
import * as path from 'path';
import { loadConfig } from './ConfigService';

/**
 * Result of an approval operation
 */
export interface ApprovalResult {
  success: boolean;
  message: string;
  snapshotName?: string;
  error?: string;
}

/**
 * Approve a single baseline by copying current to baseline
 * Also deletes the diff image
 */
export async function approveBaseline(snapshotName: string): Promise<ApprovalResult> {
  try {
    const config = loadConfig();
    const cwd = process.cwd();

    const currentPath = path.join(cwd, config.paths.current, `${snapshotName}.png`);
    const baselinePath = path.join(cwd, config.paths.baseline, `${snapshotName}.png`);
    const diffPath = path.join(cwd, config.paths.diff, `${snapshotName}.png`);

    // Check if current screenshot exists
    if (!fs.existsSync(currentPath)) {
      return {
        success: false,
        message: `Current screenshot not found: ${snapshotName}`,
        error: 'FILE_NOT_FOUND',
      };
    }

    // Ensure baseline directory exists
    await fs.ensureDir(path.dirname(baselinePath));

    // Copy current to baseline
    await fs.copyFile(currentPath, baselinePath);

    // Delete diff image if it exists
    if (fs.existsSync(diffPath)) {
      await fs.remove(diffPath);
    }

    return {
      success: true,
      message: `Successfully approved baseline for: ${snapshotName}`,
      snapshotName,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for common errors
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return {
        success: false,
        message: `Permission denied. Please check file permissions for: ${snapshotName}`,
        error: 'PERMISSION_DENIED',
      };
    }
    
    if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space')) {
      return {
        success: false,
        message: `Insufficient disk space to approve: ${snapshotName}`,
        error: 'NO_SPACE',
      };
    }

    return {
      success: false,
      message: `Failed to approve baseline for ${snapshotName}: ${errorMessage}`,
      error: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Get all failed and new snapshots that can be approved
 */
export async function getApprovableSnapshots(): Promise<string[]> {
  try {
    const config = loadConfig();
    const cwd = process.cwd();

    const currentDir = path.join(cwd, config.paths.current);
    
    if (!fs.existsSync(currentDir)) {
      return [];
    }

    const files = await fs.readdir(currentDir);
    return files
      .filter(file => file.endsWith('.png'))
      .map(file => path.basename(file, '.png'));
  } catch (error) {
    console.error('Failed to get approvable snapshots:', error);
    return [];
  }
}

/**
 * Approve multiple baselines
 */
export async function approveMultipleBaselines(
  snapshotNames: string[]
): Promise<ApprovalResult[]> {
  const results: ApprovalResult[] = [];

  for (const name of snapshotNames) {
    const result = await approveBaseline(name);
    results.push(result);
  }

  return results;
}
