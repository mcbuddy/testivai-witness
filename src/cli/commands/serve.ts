import * as http from 'http';
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadConfig } from '../../core/ConfigService';
import { approveBaseline } from '../../core/ApprovalService';

/**
 * MIME types for common file extensions
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const testServer = http.createServer();
    
    testServer.listen(startPort, () => {
      const port = (testServer.address() as any).port;
      testServer.close(() => resolve(port));
    });
    
    testServer.on('error', () => {
      // Port in use, try next one
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Handle POST /api/accept-baseline
 */
async function handleAcceptBaseline(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { snapshotName } = data;
      
      if (!snapshotName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Missing snapshotName' 
        }));
        return;
      }
      
      const result = await approveBaseline(snapshotName);
      
      res.writeHead(result.success ? 200 : 500, { 
        'Content-Type': 'application/json' 
      });
      res.end(JSON.stringify(result));
      
      if (result.success) {
        console.log(`✓ Approved baseline: ${snapshotName}`);
      } else {
        console.error(`✗ Failed to approve: ${snapshotName} - ${result.message}`);
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON' 
      }));
    }
  });
}

/**
 * Serve static files from the reports directory
 */
async function serveStaticFile(
  filePath: string,
  res: http.ServerResponse
): Promise<void> {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

/**
 * Handler for the 'tsvai serve' command
 * Starts a local server to view the TestivAI dashboard
 */
export async function serveCommand(options: { port?: string } = {}): Promise<void> {
  try {
    const config = loadConfig();
    const cwd = process.cwd();
    const reportsDir = path.join(cwd, config.paths.reports);
    
    // Check if report exists
    const indexPath = path.join(reportsDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.error('❌ No report found. Please run "npx tsvai verify" first.');
      process.exit(1);
    }
    
    // Find available port
    const requestedPort = options.port ? parseInt(options.port) : 3000;
    const port = await findAvailablePort(requestedPort);
    
    if (port !== requestedPort) {
      console.log(`⚠️  Port ${requestedPort} is in use, using port ${port} instead.`);
    }
    
    // Create server
    const server = http.createServer(async (req, res) => {
      const url = req.url || '/';
      
      // Handle health check endpoint
      if (url === '/api/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      
      // Handle API endpoint
      if (url === '/api/accept-baseline' && req.method === 'POST') {
        await handleAcceptBaseline(req, res);
        return;
      }
      
      // Serve static files
      let filePath: string;
      
      if (url === '/' || url === '/index.html') {
        filePath = indexPath;
      } else {
        // Remove leading slash and resolve path
        const requestPath = url.split('?')[0].substring(1);
        filePath = path.join(reportsDir, requestPath);
      }
      
      // Security: Ensure the file is within reportsDir
      const resolvedPath = path.resolve(filePath);
      const resolvedReportsDir = path.resolve(reportsDir);
      
      if (!resolvedPath.startsWith(resolvedReportsDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      
      await serveStaticFile(filePath, res);
    });
    
    // Start server
    server.listen(port, () => {
      console.log('\n🌐 TestivAI Dashboard Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Dashboard: http://localhost:${port}`);
      console.log(`📁 Serving:   ${path.relative(cwd, reportsDir)}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n💡 Tips:');
      console.log('  • Click "Approve Change" to accept visual changes');
      console.log('  • The page auto-refreshes every 10 seconds');
      console.log('  • Press Ctrl+C to stop the server');
      console.log('');
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down server...');
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('\n❌ Failed to start server:', error);
    console.error('\nPlease check:');
    console.error('  1. TestivAI is initialized (run "npx tsvai init")');
    console.error('  2. Report exists (run "npx tsvai verify")');
    console.error('  3. Port is available');
    process.exit(1);
  }
}
