import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
const child = Object.assign(new EventEmitter(), { kill: vi.fn(), send: vi.fn() });
vi.mock('node:child_process', () => ({ fork: () => child }));
const { recognizeImage } = await import('../src/services/storage.js');
it('kills the extraction process even when OCR initialization has not finished', async () => {
  await expect(recognizeImage(Buffer.from('image'), 'English', 5)).rejects.toMatchObject({
    code: 'OCR_TIMEOUT',
  });
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
});
