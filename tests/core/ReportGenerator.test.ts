import { generateHTMLReport } from '../../src/core/ReportGenerator';
import { VerificationSummary } from '../../src/core/VRTProcessor';

describe('ReportGenerator', () => {
  describe('generateHTMLReport', () => {
    it('should generate valid HTML with security gate', () => {
      const summary: VerificationSummary = {
        total: 2,
        passed: 1,
        failed: 1,
        new: 0,
        missing: 0,
        errors: 0,
        results: [
          {
            name: 'passed-test',
            status: 'passed',
            diffPixelRatio: 0,
            diffPixelCount: 0,
            totalPixels: 10000,
            threshold: 0.001,
            baselinePath: '.testivai/artifacts/baselines/passed-test.png',
            currentPath: '.testivai/artifacts/current/passed-test.png',
            diffPath: '.testivai/artifacts/diffs/passed-test.png',
          },
          {
            name: 'failed-test',
            status: 'failed',
            diffPixelRatio: 0.05,
            diffPixelCount: 500,
            totalPixels: 10000,
            threshold: 0.001,
            baselinePath: '.testivai/artifacts/baselines/failed-test.png',
            currentPath: '.testivai/artifacts/current/failed-test.png',
            diffPath: '.testivai/artifacts/diffs/failed-test.png',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Check for basic HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TestivAI Insight Dashboard');
      
      // Check for security gate function
      expect(html).toContain('checkServerStatus');
      expect(html).toContain('/api/status');
      
      // Check for approve buttons (hidden by default)
      expect(html).toContain('approve-btn');
      expect(html).toContain('style="display: none;"');
      
      // Check for read-only message
      expect(html).toContain('read-only-message');
      expect(html).toContain('View-only mode');
      expect(html).toContain('npx tsvai serve');
      
      // Check for summary stats
      expect(html).toContain('Total');
      expect(html).toContain('2');
      expect(html).toContain('Passed');
      expect(html).toContain('1');
      expect(html).toContain('Diff Detected');
    });

    it('should not show approve button for passed tests', () => {
      const summary: VerificationSummary = {
        total: 1,
        passed: 1,
        failed: 0,
        new: 0,
        missing: 0,
        errors: 0,
        results: [
          {
            name: 'passed-test',
            status: 'passed',
            diffPixelRatio: 0,
            diffPixelCount: 0,
            totalPixels: 10000,
            threshold: 0.001,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Should not have approve button for passed tests
      const passedCard = html.match(/<div class="comparison-card" data-status="passed">[\s\S]*?<\/div>\s*<\/div>/);
      expect(passedCard).toBeTruthy();
      if (passedCard) {
        expect(passedCard[0]).not.toContain('approve-btn');
      }
    });

    it('should show approve button for failed tests', () => {
      const summary: VerificationSummary = {
        total: 1,
        passed: 0,
        failed: 1,
        new: 0,
        missing: 0,
        errors: 0,
        results: [
          {
            name: 'failed-test',
            status: 'failed',
            diffPixelRatio: 0.05,
            diffPixelCount: 500,
            totalPixels: 10000,
            threshold: 0.001,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Should have approve button for failed tests
      expect(html).toContain('approve-btn');
      expect(html).toContain('data-screenshot-name="failed-test"');
    });

    it('should show approve button for new tests', () => {
      const summary: VerificationSummary = {
        total: 1,
        passed: 0,
        failed: 0,
        new: 1,
        missing: 0,
        errors: 0,
        results: [
          {
            name: 'new-test',
            status: 'new',
            diffPixelRatio: 0,
            diffPixelCount: 0,
            totalPixels: 0,
            threshold: 0.001,
            currentPath: '.testivai/artifacts/current/new-test.png',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Should have approve button for new tests
      expect(html).toContain('approve-btn');
      expect(html).toContain('data-screenshot-name="new-test"');
    });

    it('should include auto-refresh logic', () => {
      const summary: VerificationSummary = {
        total: 0,
        passed: 0,
        failed: 0,
        new: 0,
        missing: 0,
        errors: 0,
        results: [],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Check for auto-refresh code
      expect(html).toContain('autoRefreshInterval');
      expect(html).toContain('setInterval');
      expect(html).toContain('10000'); // 10 seconds
    });

    it('should include filter functionality', () => {
      const summary: VerificationSummary = {
        total: 2,
        passed: 1,
        failed: 1,
        new: 0,
        missing: 0,
        errors: 0,
        results: [],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Check for filter buttons (only non-zero)
      expect(html).toContain('filter-btn');
      expect(html).toContain('data-filter="all"');
      expect(html).toContain('data-filter="failed"');
      expect(html).toContain('data-filter="passed"');
      // Should not contain zero-count filters
      expect(html).not.toContain('data-filter="new"');
      expect(html).not.toContain('data-filter="missing"');
      expect(html).not.toContain('data-filter="error"');
    });

    it('should hide zero-value stats in summary', () => {
      const summary: VerificationSummary = {
        total: 1,
        passed: 1,
        failed: 0,
        new: 0,
        missing: 0,
        errors: 0,
        results: [],
        timestamp: new Date().toISOString(),
      };

      const html = generateHTMLReport(summary);

      // Should show Total and Passed
      expect(html).toContain('Total');
      expect(html).toContain('Passed');
      
      // Should not show zero-value stats in summary
      expect(html).not.toContain('<div class="label">Diff Detected</div>');
      expect(html).not.toContain('<div class="label">New</div>');
      expect(html).not.toContain('<div class="label">Missing</div>');
      expect(html).not.toContain('<div class="label">Errors</div>');
    });
  });
});
