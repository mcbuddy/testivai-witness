import { generateUUID } from '../utils/uuid';

/**
 * Metadata structure for captured states
 */
export interface CaptureMetadata {
  id: string;
  name: string;
  screenshotPath: string;
  domSnippet: string;
  timestamp: string;
  environment?: string;
  viewport?: {
    width: number;
    height: number;
  };
  testFile?: string;
  testTitle?: string;
  error?: string;
}

/**
 * Singleton StateLogger for managing capture metadata
 * Thread-safe for parallel test execution
 */
export class StateLogger {
  private static instance: StateLogger;
  private capturesByTestFile: Map<string, CaptureMetadata[]> = new Map();
  private readonly maxCapturesPerFile = 1000; // Prevent memory overflow

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): StateLogger {
    if (!StateLogger.instance) {
      StateLogger.instance = new StateLogger();
    }
    return StateLogger.instance;
  }

  /**
   * Log a capture with metadata
   * @param metadata - Partial metadata (id will be generated)
   * @param testFile - Test file path for partitioning (optional)
   */
  logCapture(metadata: Omit<CaptureMetadata, 'id' | 'timestamp'>, testFile?: string): void {
    const capture: CaptureMetadata = {
      ...metadata,
      id: generateUUID(),
      timestamp: new Date().toISOString(),
    };

    const fileKey = testFile || 'default';
    
    // Initialize array if not exists
    if (!this.capturesByTestFile.has(fileKey)) {
      this.capturesByTestFile.set(fileKey, []);
    }
    
    const captures = this.capturesByTestFile.get(fileKey)!;
    captures.push(capture);

    // FIFO eviction if limit exceeded
    if (captures.length > this.maxCapturesPerFile) {
      captures.shift();
    }
  }

  /**
   * Get all captured metadata across all test files
   */
  getCaptures(): CaptureMetadata[] {
    const allCaptures: CaptureMetadata[] = [];
    for (const captures of this.capturesByTestFile.values()) {
      allCaptures.push(...captures);
    }
    return allCaptures;
  }

  /**
   * Get captures for a specific test file
   */
  getCapturesByTestFile(testFile: string): CaptureMetadata[] {
    const captures = this.capturesByTestFile.get(testFile) || [];
    return [...captures]; // Return copy
  }

  /**
   * Get captures by name across all test files
   */
  getCapturesByName(name: string): CaptureMetadata[] {
    const allCaptures = this.getCaptures();
    return allCaptures.filter(c => c.name === name);
  }

  /**
   * Clear all captures
   */
  clear(): void {
    this.capturesByTestFile.clear();
  }

  /**
   * Clear captures for a specific test file
   */
  clearTestFile(testFile: string): void {
    this.capturesByTestFile.delete(testFile);
  }

  /**
   * Get the total number of captures across all test files
   */
  size(): number {
    let total = 0;
    for (const captures of this.capturesByTestFile.values()) {
      total += captures.length;
    }
    return total;
  }

  /**
   * Get all test files with captures
   */
  getTestFiles(): string[] {
    return Array.from(this.capturesByTestFile.keys());
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static reset(): void {
    StateLogger.instance = new StateLogger();
  }
}
