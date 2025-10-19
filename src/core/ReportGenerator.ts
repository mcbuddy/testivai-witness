import * as fs from 'fs-extra';
import * as path from 'path';
import { VerificationSummary, ComparisonResult } from './VRTProcessor';

/**
 * Generate status badge HTML
 */
function generateStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    passed: '#10b981',
    failed: '#f59e0b', // Same as missing (yellow/amber)
    new: '#3b82f6',
    missing: '#f59e0b',
    error: '#6b7280',
  };

  const labels: Record<string, string> = {
    passed: 'Passed',
    failed: 'Diff Detected',
    new: 'New',
    missing: 'Missing',
    error: 'Error',
  };

  const color = colors[status] || colors.error;
  const label = labels[status] || status.charAt(0).toUpperCase() + status.slice(1);

  return `<span class="status-badge status-${status}" style="background-color: ${color}">${label}</span>`;
}

/**
 * Generate comparison card HTML
 */
function generateComparisonCard(result: ComparisonResult): string {
  const diffPercentage = (result.diffPixelRatio * 100).toFixed(2);
  const statusBadge = generateStatusBadge(result.status);

  let imagesHTML = '';

  if (result.status === 'new') {
    imagesHTML = `
      <div class="image-panel">
        <div class="image-container single">
          <div class="image-label">Current (New)</div>
          <img src="images/${result.name}-current.png" alt="${result.name} current" />
        </div>
      </div>
    `;
  } else if (result.status === 'missing') {
    imagesHTML = `
      <div class="image-panel">
        <div class="image-container single">
          <div class="image-label">Baseline (Missing Current)</div>
          <img src="images/${result.name}-baseline.png" alt="${result.name} baseline" />
        </div>
      </div>
      <div class="warning-message">
        ⚠️ Current screenshot is missing. This test may have been intentionally deleted.
      </div>
    `;
  } else if (result.status === 'error') {
    imagesHTML = `
      <div class="error-message">
        ❌ Error: ${result.error || 'Unknown error occurred'}
      </div>
    `;
  } else {
    // passed or failed - show three-panel view
    imagesHTML = `
      <div class="image-panel three-panel">
        <div class="image-container">
          <div class="image-label">Baseline</div>
          <img src="images/${result.name}-baseline.png" alt="${result.name} baseline" />
        </div>
        <div class="image-container">
          <div class="image-label">Current</div>
          <img src="images/${result.name}-current.png" alt="${result.name} current" />
        </div>
        <div class="image-container">
          <div class="image-label">Diff</div>
          <img src="images/${result.name}-diff.png" alt="${result.name} diff" />
        </div>
      </div>
    `;
  }

  const approveButton = (result.status === 'failed' || result.status === 'new') ? `
    <button 
      class="approve-btn"
      data-screenshot-name="${result.name}"
      data-baseline-path="${result.baselinePath || ''}"
      data-current-path="${result.currentPath || ''}"
      data-action="approve"
      style="display: none;"
    >
      ✓ Approve Change
    </button>
  ` : '';
  
  const readOnlyMessage = (result.status === 'failed' || result.status === 'new') ? `
    <div class="read-only-message" style="display: none;">
      <span class="read-only-icon">🔒</span>
      <span class="read-only-text">View-only mode - Start local server to approve changes</span>
      <code class="read-only-command">npx tsvai serve</code>
    </div>
  ` : '';

  return `
    <div class="comparison-card" data-status="${result.status}">
      <div class="card-header">
        <h3 class="screenshot-name">${result.name}</h3>
        <div class="card-meta">
          ${statusBadge}
          ${result.status === 'passed' || result.status === 'failed' ? 
            `<span class="diff-ratio">${diffPercentage}% diff</span>` : ''}
        </div>
      </div>
      ${imagesHTML}
      ${approveButton || readOnlyMessage ? `<div class="card-actions">${approveButton}${readOnlyMessage}</div>` : ''}
    </div>
  `;
}

/**
 * Generate the complete HTML dashboard
 */
export function generateHTMLReport(summary: VerificationSummary): string {
  const cardsHTML = summary.results
    .map(result => generateComparisonCard(result))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestivAI Insight Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f9fafb;
      color: #111827;
      line-height: 1.5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #6366f1;
    }

    .header .subtitle {
      color: #6b7280;
      font-size: 0.875rem;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .summary-card {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .summary-card .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .summary-card .value {
      font-size: 2rem;
      font-weight: 700;
      margin-top: 0.25rem;
    }

    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: #f3f4f6;
    }

    .filter-btn.active {
      background: #6366f1;
      color: white;
      border-color: #6366f1;
    }

    .comparison-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
      overflow: hidden;
    }

    .card-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .screenshot-name {
      font-size: 1.125rem;
      font-weight: 600;
    }

    .card-meta {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .diff-ratio {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    }

    .image-panel {
      padding: 1.5rem;
      background: #f9fafb;
    }

    .image-panel.three-panel {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }

    .image-container {
      background: white;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .image-container.single {
      max-width: 600px;
      margin: 0 auto;
    }

    .image-label {
      padding: 0.5rem 1rem;
      background: #f3f4f6;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
    }

    .image-container img {
      width: 100%;
      height: auto;
      display: block;
    }

    .card-actions {
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
    }

    .approve-btn {
      padding: 0.75rem 1.5rem;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .approve-btn:hover {
      background: #059669;
    }

    .approve-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .read-only-message {
      padding: 0.75rem 1rem;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .read-only-icon {
      font-size: 1rem;
    }

    .read-only-text {
      flex: 1;
    }

    .read-only-command {
      padding: 0.25rem 0.5rem;
      background: #1f2937;
      color: #10b981;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .warning-message {
      padding: 1rem 1.5rem;
      background: #fef3c7;
      color: #92400e;
      border-left: 4px solid #f59e0b;
      margin: 1rem 1.5rem;
      border-radius: 4px;
    }

    .error-message {
      padding: 1rem 1.5rem;
      background: #fee2e2;
      color: #991b1b;
      border-left: 4px solid #ef4444;
      margin: 1rem 1.5rem;
      border-radius: 4px;
    }

    @media (max-width: 768px) {
      .image-panel.three-panel {
        grid-template-columns: 1fr;
      }

      .summary {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 TestivAI Insight Dashboard</h1>
      <p class="subtitle">Generated on ${new Date(summary.timestamp).toLocaleString()}</p>
      
      <div class="summary">
        <div class="summary-card">
          <div class="label">Total</div>
          <div class="value">${summary.total}</div>
        </div>
        ${summary.passed > 0 ? `
        <div class="summary-card">
          <div class="label">Passed</div>
          <div class="value" style="color: #10b981">${summary.passed}</div>
        </div>
        ` : ''}
        ${summary.failed > 0 ? `
        <div class="summary-card">
          <div class="label">Diff Detected</div>
          <div class="value" style="color: #f59e0b">${summary.failed}</div>
        </div>
        ` : ''}
        ${summary.new > 0 ? `
        <div class="summary-card">
          <div class="label">New</div>
          <div class="value" style="color: #3b82f6">${summary.new}</div>
        </div>
        ` : ''}
        ${summary.missing > 0 ? `
        <div class="summary-card">
          <div class="label">Missing</div>
          <div class="value" style="color: #f59e0b">${summary.missing}</div>
        </div>
        ` : ''}
        ${summary.errors > 0 ? `
        <div class="summary-card">
          <div class="label">Errors</div>
          <div class="value" style="color: #6b7280">${summary.errors}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      ${summary.failed > 0 ? '<button class="filter-btn" data-filter="failed">Diff Detected</button>' : ''}
      ${summary.new > 0 ? '<button class="filter-btn" data-filter="new">New</button>' : ''}
      ${summary.passed > 0 ? '<button class="filter-btn" data-filter="passed">Passed</button>' : ''}
      ${summary.missing > 0 ? '<button class="filter-btn" data-filter="missing">Missing</button>' : ''}
      ${summary.errors > 0 ? '<button class="filter-btn" data-filter="error">Errors</button>' : ''}
    </div>

    <div class="comparisons">
      ${cardsHTML}
    </div>
  </div>

  <script>
    // Security Gate: Check if local server is running
    async function checkServerStatus() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch('/api/status', {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          // Server is running - show approve buttons
          const approveButtons = document.querySelectorAll('.approve-btn');
          const readOnlyMessages = document.querySelectorAll('.read-only-message');
          
          approveButtons.forEach(btn => {
            btn.style.display = 'inline-block';
          });
          
          readOnlyMessages.forEach(msg => {
            msg.style.display = 'none';
          });
          
          console.log('✓ Local server detected - Approve buttons enabled');
          return true;
        } else {
          throw new Error('Server not responding');
        }
      } catch (error) {
        // Server not running - show read-only message
        const approveButtons = document.querySelectorAll('.approve-btn');
        const readOnlyMessages = document.querySelectorAll('.read-only-message');
        
        approveButtons.forEach(btn => {
          btn.style.display = 'none';
        });
        
        readOnlyMessages.forEach(msg => {
          msg.style.display = 'flex';
        });
        
        console.log('ℹ View-only mode - Start server with "npx tsvai serve" to approve changes');
        return false;
      }
    }

    // Run security check on page load
    let isServerRunning = false;
    checkServerStatus().then(result => {
      isServerRunning = result;
    });

    // Filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const comparisonCards = document.querySelectorAll('.comparison-card');

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        
        // Update active button
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter cards
        comparisonCards.forEach(card => {
          const status = card.dataset.status;
          if (filter === 'all' || status === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Approve button functionality
    const approveButtons = document.querySelectorAll('.approve-btn');
    approveButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.screenshotName;
        
        // Disable button during request
        btn.disabled = true;
        btn.textContent = '⏳ Approving...';
        
        try {
          const response = await fetch('/api/accept-baseline', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ snapshotName: name }),
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Show success message
            btn.textContent = '✓ Approved!';
            btn.style.backgroundColor = '#10b981';
            
            // Show success notification
            showNotification('Success', \`Baseline approved for: \${name}\`, 'success');
            
            // Reload page after 1 second
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            // Show error
            btn.textContent = '✗ Failed';
            btn.style.backgroundColor = '#ef4444';
            showNotification('Error', result.message || 'Failed to approve baseline', 'error');
            
            // Re-enable button after 2 seconds
            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = '✓ Approve Change';
              btn.style.backgroundColor = '#10b981';
            }, 2000);
          }
        } catch (error) {
          btn.textContent = '✗ Network Error';
          btn.style.backgroundColor = '#ef4444';
          showNotification('Error', 'Failed to connect to server', 'error');
          
          // Re-enable button after 2 seconds
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '✓ Approve Change';
            btn.style.backgroundColor = '#10b981';
          }, 2000);
        }
      });
    });

    // Notification system
    function showNotification(title, message, type) {
      const notification = document.createElement('div');
      notification.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: \${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
      \`;
      notification.innerHTML = \`
        <div style="font-weight: 600; margin-bottom: 0.25rem;">\${title}</div>
        <div style="font-size: 0.875rem;">\${message}</div>
      \`;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    // Auto-refresh every 10 seconds (only if server is running)
    let autoRefreshInterval = null;
    
    checkServerStatus().then(serverRunning => {
      if (serverRunning) {
        autoRefreshInterval = setInterval(() => {
          console.log('Auto-refreshing dashboard...');
          window.location.reload();
        }, 10000);
      }
    });

    // Clear interval when page is hidden (user switched tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
        }
      } else if (isServerRunning) {
        autoRefreshInterval = setInterval(() => {
          window.location.reload();
        }, 10000);
      }
    });
  </script>

  <style>
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  </style>
</body>
</html>`;
}

/**
 * Write the HTML report to file
 */
export async function writeHTMLReport(
  summary: VerificationSummary,
  outputPath: string
): Promise<void> {
  const html = generateHTMLReport(summary);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, html, 'utf-8');
}
