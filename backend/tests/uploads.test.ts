import { it, expect } from 'vitest';
import { validateUpload } from '../src/services/storage.js';
it('accepts a PDF only when the signature and extension match', () => {
  expect(validateUpload(Buffer.from('%PDF-1.7\n'), 'chapter.pdf').mime).toBe('application/pdf');
});
it('rejects executable content disguised as PDF', () => {
  expect(() => validateUpload(Buffer.from('<script>alert(1)</script>'), 'chapter.pdf')).toThrow();
});
it('rejects a mismatched file extension', () => {
  expect(() => validateUpload(Buffer.from('%PDF-1.7\n'), 'chapter.png')).toThrow();
});
it('rejects files over 10 MB', () => {
  expect(() => validateUpload(Buffer.alloc(10 * 1024 * 1024 + 1), 'chapter.pdf')).toThrow();
});
it('rejects a JPEG whose decoded dimensions exceed 16 megapixels', () => {
  const image = Buffer.from([
    255, 216, 255, 192, 0, 11, 8, 255, 255, 255, 255, 1, 1, 17, 0, 255, 217,
  ]);
  expect(() => validateUpload(image, 'oversized.jpg')).toThrow('16 megapixels');
});
it('rejects truncated JPEG headers before OCR', () => {
  expect(() => validateUpload(Buffer.from([255, 216, 255]), 'broken.jpg')).toThrow();
});
