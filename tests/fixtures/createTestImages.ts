import { PNG } from 'pngjs';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Create a simple test PNG image with a solid color
 */
export function createTestImage(width: number, height: number, color: [number, number, number]): PNG {
  const png = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];     // Red
      png.data[idx + 1] = color[1]; // Green
      png.data[idx + 2] = color[2]; // Blue
      png.data[idx + 3] = 255;      // Alpha
    }
  }
  
  return png;
}

/**
 * Save a PNG image to file
 */
export async function saveTestImage(png: PNG, filePath: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  const buffer = PNG.sync.write(png);
  await fs.writeFile(filePath, buffer);
}

/**
 * Create a test image with a rectangle
 */
export function createImageWithRectangle(
  width: number,
  height: number,
  bgColor: [number, number, number],
  rectColor: [number, number, number],
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): PNG {
  const png = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      
      // Check if pixel is inside rectangle
      const inRect = x >= rectX && x < rectX + rectWidth &&
                     y >= rectY && y < rectY + rectHeight;
      
      const color = inRect ? rectColor : bgColor;
      
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 255;
    }
  }
  
  return png;
}
