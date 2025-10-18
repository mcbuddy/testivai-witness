import { loadConfig } from './ConfigService';

/**
 * Options for HTTP send operation
 */
interface SendOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Response from the ingestion endpoint
 */
interface IngestionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send payload to TestivAI ingestion endpoint with retry logic
 * @param payload - The normalized JSON payload to send
 * @param options - Send options including retry configuration
 */
export async function sendIngestion(
  payload: any,
  options: SendOptions = {}
): Promise<IngestionResponse> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
  } = options;

  // Load config to check if API is enabled
  const config = loadConfig();
  if (config.api && !config.api.enabled) {
    console.log('TestivAI API is disabled in configuration');
    return { success: false, message: 'API disabled' };
  }

  // Get API endpoint
  const apiUrl = process.env.TESTIVAI_API_URL || 
    config.api?.endpoint || 
    'http://localhost:8000/api/v1/ingest';

  // Get API key
  const apiKey = process.env.TESTIVAI_KEY || 'FREE-TIER-USER';

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-TestivAI-Version': '1.0.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({})) as any;

      if (response.ok) {
        console.log(`✓ TestivAI: Successfully sent ${payload.captures?.length || 0} captures to API`);
        return {
          success: true,
          message: responseData.message || 'Success',
        };
      } else {
        // Non-retryable errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          console.error(`TestivAI API error (${response.status}): ${responseData.error || response.statusText}`);
          return {
            success: false,
            error: responseData.error || `HTTP ${response.status}`,
          };
        }

        // Retryable error (5xx)
        throw new Error(`HTTP ${response.status}: ${responseData.error || response.statusText}`);
      }
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`TestivAI API timeout after ${timeout}ms (attempt ${attempt}/${maxRetries})`);
      } else {
        console.error(`TestivAI API error (attempt ${attempt}/${maxRetries}): ${error}`);
      }

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  console.error(`TestivAI: Failed to send data after ${maxRetries} attempts`);
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Write payload to local file for debugging
 * @param payload - The payload to write
 * @param filename - Optional filename (defaults to timestamp)
 */
export async function writePayloadToFile(payload: any, filename?: string): Promise<void> {
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const config = loadConfig();
    const reportsDir = path.join(process.cwd(), config.paths.reports);
    await fs.ensureDir(reportsDir);

    const fileName = filename || `testivai-payload-${Date.now()}.json`;
    const filePath = path.join(reportsDir, fileName);
    
    await fs.writeJson(filePath, payload, { spaces: 2 });
    console.log(`TestivAI: Payload written to ${path.relative(process.cwd(), filePath)}`);
  } catch (error) {
    console.error('Failed to write payload to file:', error);
  }
}
