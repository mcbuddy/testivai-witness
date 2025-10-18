import { StateLogger, CaptureMetadata } from '../../src/core/StateLogger';

describe('StateLogger', () => {
  beforeEach(() => {
    // Reset singleton before each test
    StateLogger.reset();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = StateLogger.getInstance();
      const instance2 = StateLogger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const logger1 = StateLogger.getInstance();
      logger1.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<html></html>',
      });

      const logger2 = StateLogger.getInstance();
      expect(logger2.size()).toBe(1);
    });
  });

  describe('logCapture', () => {
    it('should add capture with generated id and timestamp', () => {
      const logger = StateLogger.getInstance();
      const beforeTime = new Date().toISOString();

      logger.logCapture({
        name: 'homepage',
        screenshotPath: '.testivai/artifacts/current/homepage.png',
        domSnippet: '<body>Test</body>',
        environment: 'desktop-hd',
        viewport: { width: 1920, height: 1080 },
      });

      const afterTime = new Date().toISOString();
      const captures = logger.getCaptures();

      expect(captures).toHaveLength(1);
      expect(captures[0].id).toMatch(/^[0-9a-f-]+$/);
      expect(captures[0].name).toBe('homepage');
      expect(captures[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(captures[0].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(captures[0].timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });

    it('should handle error metadata', () => {
      const logger = StateLogger.getInstance();

      logger.logCapture({
        name: 'error-capture',
        screenshotPath: '',
        domSnippet: '',
        error: 'Failed to capture screenshot',
      });

      const captures = logger.getCaptures();
      expect(captures[0].error).toBe('Failed to capture screenshot');
    });

    it('should enforce max captures limit with FIFO eviction', () => {
      const logger = StateLogger.getInstance();
      const maxCaptures = 1000;

      // Add more than max captures
      for (let i = 0; i < maxCaptures + 10; i++) {
        logger.logCapture({
          name: `capture-${i}`,
          screenshotPath: `path-${i}.png`,
          domSnippet: `<div>${i}</div>`,
        });
      }

      expect(logger.size()).toBe(maxCaptures);
      
      // First 10 should be evicted
      const captures = logger.getCaptures();
      expect(captures[0].name).toBe('capture-10');
      expect(captures[captures.length - 1].name).toBe(`capture-${maxCaptures + 9}`);
    });
  });

  describe('getCaptures', () => {
    it('should return a copy of captures array', () => {
      const logger = StateLogger.getInstance();
      
      logger.logCapture({
        name: 'test',
        screenshotPath: 'test.png',
        domSnippet: '<html></html>',
      });

      const captures1 = logger.getCaptures();
      const captures2 = logger.getCaptures();

      expect(captures1).not.toBe(captures2); // Different array references
      expect(captures1).toEqual(captures2);   // Same content
    });
  });

  describe('getCapturesByName', () => {
    it('should filter captures by name', () => {
      const logger = StateLogger.getInstance();

      logger.logCapture({
        name: 'homepage',
        screenshotPath: 'homepage1.png',
        domSnippet: '<div>1</div>',
      });

      logger.logCapture({
        name: 'about',
        screenshotPath: 'about.png',
        domSnippet: '<div>About</div>',
      });

      logger.logCapture({
        name: 'homepage',
        screenshotPath: 'homepage2.png',
        domSnippet: '<div>2</div>',
      });

      const homepageCaptures = logger.getCapturesByName('homepage');
      expect(homepageCaptures).toHaveLength(2);
      expect(homepageCaptures[0].screenshotPath).toBe('homepage1.png');
      expect(homepageCaptures[1].screenshotPath).toBe('homepage2.png');

      const aboutCaptures = logger.getCapturesByName('about');
      expect(aboutCaptures).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should remove all captures', () => {
      const logger = StateLogger.getInstance();

      logger.logCapture({
        name: 'test1',
        screenshotPath: 'test1.png',
        domSnippet: '<div>1</div>',
      });

      logger.logCapture({
        name: 'test2',
        screenshotPath: 'test2.png',
        domSnippet: '<div>2</div>',
      });

      expect(logger.size()).toBe(2);

      logger.clear();
      expect(logger.size()).toBe(0);
      expect(logger.getCaptures()).toEqual([]);
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent logCapture calls', async () => {
      const logger = StateLogger.getInstance();
      const promises: Promise<void>[] = [];

      // Simulate concurrent captures
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.logCapture({
                name: `concurrent-${i}`,
                screenshotPath: `path-${i}.png`,
                domSnippet: `<div>${i}</div>`,
              });
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      expect(logger.size()).toBe(10);
      const names = logger.getCaptures().map(c => c.name);
      expect(new Set(names).size).toBe(10); // All unique names captured
    });
  });
});
