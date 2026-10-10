import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { ApiError } from '../http.js';
import type { Language } from '@wonderlab/shared';
export interface StorageProvider {
  put(key: string, buffer: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export class LocalStorageProvider implements StorageProvider {
  constructor(private directory = resolve(config.STORAGE_PATH)) {}
  private path(key: string) {
    if (!/^[a-f0-9-]+\.(pdf|png|jpg)$/.test(key))
      throw new ApiError(400, 'INVALID_STORAGE_KEY', 'Invalid file.');
    return resolve(this.directory, key);
  }
  async put(key: string, buffer: Buffer) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(this.path(key), buffer, { mode: 0o600 });
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async delete(key: string) {
    await unlink(this.path(key)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
export function validateUpload(buffer: Buffer, name: string): { mime: string; extension: string } {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new ApiError(413, 'FILE_TOO_LARGE', 'Choose a file between 1 byte and 10 MB.');
  const extension = extname(basename(name)).toLowerCase();
  const pdf = buffer.subarray(0, 5).toString() === '%PDF-';
  const png =
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (pdf && extension === '.pdf') return { mime: 'application/pdf', extension: 'pdf' };
  if (png && extension === '.png') {
    const width = buffer.readUInt32BE(16),
      height = buffer.readUInt32BE(20);
    if (!width || !height || width * height > 16000000)
      throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Use an image smaller than 16 megapixels.');
    return { mime: 'image/png', extension: 'png' };
  }
  if (jpeg && ['.jpg', '.jpeg'].includes(extension)) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 255) break;
      const marker = buffer[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        length >= 8
      ) {
        const height = buffer.readUInt16BE(offset + 5),
          width = buffer.readUInt16BE(offset + 7);
        if (!width || !height || width * height > 16000000)
          throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Use an image smaller than 16 megapixels.');
        return { mime: 'image/jpeg', extension: 'jpg' };
      }
      offset += length + 2;
    }
    throw new ApiError(
      400,
      'INVALID_FILE',
      'This JPEG could not be validated. Choose a genuine JPEG image.',
    );
  }
  throw new ApiError(
    400,
    'INVALID_FILE',
    'Choose a genuine PDF, PNG or JPEG file with a matching extension.',
  );
}
export async function recognizeImage(
  buffer: Buffer,
  language: Language,
  timeoutMs = 60000,
): Promise<string> {
  const sourceExtension = extname(fileURLToPath(import.meta.url));
  const child = fork(
    fileURLToPath(new URL('./ocr-worker' + sourceExtension, import.meta.url)),
    [],
    { silent: true },
  );
  return new Promise((resolveText, reject) => {
    let settled = false;
    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      if (error) reject(error);
      else resolveText(text || '');
    };
    const timer = setTimeout(
      () =>
        finish(
          new ApiError(
            408,
            'OCR_TIMEOUT',
            'Reading this image took too long. Try a smaller, clearer image.',
          ),
        ),
      timeoutMs,
    );
    child.once('error', () =>
      finish(
        new ApiError(
          400,
          'OCR_FAILED',
          'This image could not be read. Use a clear image with printed text.',
        ),
      ),
    );
    child.once('exit', () =>
      finish(
        new ApiError(
          400,
          'OCR_FAILED',
          'This image could not be read. Use a clear image with printed text.',
        ),
      ),
    );
    child.once('message', (message: unknown) => {
      const result = message as { text?: string; error?: boolean };
      finish(
        result.error
          ? new ApiError(
              400,
              'OCR_FAILED',
              'This image could not be read. Use a clear image with printed text.',
            )
          : undefined,
        result.text,
      );
    });
    child.send({
      image: buffer.toString('base64'),
      language: language === 'Chinese' ? 'chi_sim' : language === 'Bahasa Melayu' ? 'msa' : 'eng',
      directory: resolve(config.STORAGE_PATH),
    });
  });
}
export interface ContentExtractor {
  extract(buffer: Buffer, mime: string, language: Language): Promise<string>;
}
export class LocalContentExtractor implements ContentExtractor {
  async extract(buffer: Buffer, mime: string, language: Language) {
    let content = '';
    if (mime === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo();
        if (info.total > 30)
          throw new ApiError(400, 'PDF_TOO_LONG', 'Upload up to 30 pages at a time.');
        content = (await parser.getText({ first: 30 })).text;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          400,
          'UNREADABLE_PDF',
          'This PDF could not be read. Try a text-based PDF or upload a clear image of the page.',
        );
      } finally {
        await parser.destroy();
      }
    } else {
      content = await recognizeImage(buffer, language);
    }
    content = content.trim();
    if (content.length < 10)
      throw new ApiError(
        400,
        'NO_TEXT_FOUND',
        'We could not find enough readable text. Try a clearer image or paste the content.',
      );
    if (content.length > 40000)
      throw new ApiError(
        400,
        'CONTENT_TOO_LONG',
        'Use a shorter chapter with up to 40,000 characters.',
      );
    return content;
  }
}
export const storage = new LocalStorageProvider();
export const extractor = new LocalContentExtractor();
export const storageKey = (extension: string) => randomUUID() + '.' + extension;
