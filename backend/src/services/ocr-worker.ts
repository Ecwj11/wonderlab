// OCR runs in a disposable process so timeouts also stop language downloads and initialization.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWorker } from 'tesseract.js';
process.once('message', async (message: { image: string; language: string; directory: string }) => {
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    const cachePath = resolve(message.directory, 'ocr-cache');
    await mkdir(cachePath, { recursive: true, mode: 0o700 });
    worker = await createWorker(message.language, 1, { cachePath });
    const result = await worker.recognize(Buffer.from(message.image, 'base64'));
    process.send?.({ text: result.data.text });
  } catch {
    process.send?.({ error: true });
  } finally {
    if (worker) await worker.terminate();
    process.disconnect();
  }
});
