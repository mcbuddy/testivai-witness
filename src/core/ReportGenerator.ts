import * as fs from 'fs-extra';
import * as path from 'path';
import { VerificationSummary, ComparisonResult } from './VRTProcessor';

/**
 * Generate status badge HTML
 */
function generateStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    passed: '#10b981',
    failed: '#ef4444',
    new: '#3b82f6',
    missing: '#f59e0b',
    error: '#6b7280',
  };

  const color = colors[status] || colors.error;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

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
    >
      ✓ Approve Change
    </button>
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
      ${approveButton ? `<div class="card-actions">${approveButton}</div>` : ''}
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
        <div class="summary-card">
          <div class="label">Passed</div>
          <div class="value" style="color: #10b981">${summary.passed}</div>
        </div>
        <div class="summary-card">
          <div class="label">Failed</div>
          <div class="value" style="color: #ef4444">${summary.failed}</div>
        </div>
        <div class="summary-card">
          <div class="label">New</div>
          <div class="value" style="color: #3b82f6">${summary.new}</div>
        </div>
        <div class="summary-card">
          <div class="label">Missing</div>
          <div class="value" style="color: #f59e0b">${summary.missing}</div>
        </div>
        <div class="summary-card">
          <div class="label">Errors</div>
          <div class="value" style="color: #6b7280">${summary.errors}</div>
        </div>
      </div>
    </div>

    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="failed">Failed</button>
      <button class="filter-btn" data-filter="new">New</button>
      <button class="filter-btn" data-filter="passed">Passed</button>
      <button class="filter-btn" data-filter="missing">Missing</button>
      <button class="filter-btn" data-filter="error">Errors</button>
    </div>

    <div class="comparisons">
      ${cardsHTML}
    </div>
  </div>

  <script>
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

    // Approve button placeholder (to be implemented later)
    const approveButtons = document.querySelectorAll('.approve-btn');
    approveButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.screenshotName;
        alert(\`Approve functionality will be implemented in the next phase.\\nScreenshot: \${name}\`);
      });
    });
  </script>
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
