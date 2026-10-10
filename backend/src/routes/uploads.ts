import { assertLessonCreator } from '../services/lesson-permissions.js';
import { assertLearning } from '../services/family.js';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { languageSchema } from '@wonderlab/shared';
import { authenticate } from '../auth.js';
import { run } from '../db/pool.js';
import { ApiError } from '../http.js';
import { storage, extractor, storageKey, validateUpload } from '../services/storage.js';
export const uploadsRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
});
let extracting = 0;
uploadsRouter.post(
  '/uploads',
  authenticate,
  async (req, _res, next) => {
    assertLessonCreator(req.user!);
    await assertLearning(req.user!, undefined, true);
    next();
  },
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error instanceof multer.MulterError)
        return next(
          new ApiError(
            400,
            'UPLOAD_INVALID',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Files must be 10 MB or smaller.'
              : 'Upload one supported file at a time.',
          ),
        );
      next(error);
    });
  },
  async (req, res) => {
    if (!req.file) throw new ApiError(400, 'FILE_REQUIRED', 'Choose a PDF, PNG or JPEG file.');
    if (extracting >= 2)
      throw new ApiError(
        429,
        'EXTRACTION_BUSY',
        'We’re reading other materials. Please try again in a moment.',
      );
    const language = languageSchema.default('English').parse(req.body.language);
    const file = req.file;
    const { mime, extension } = validateUpload(file.buffer, file.originalname);
    let content: string;
    extracting++;
    try {
      content = await extractor.extract(file.buffer, mime, language);
    } finally {
      extracting--;
    }
    const id = randomUUID(),
      key = storageKey(extension);
    await storage.put(key, file.buffer);
    try {
      await run(
        'INSERT INTO uploaded_files(id,user_id,original_name,storage_key,mime_type,size_bytes,extracted_content) VALUES(?,?,?,?,?,?,?)',
        [
          id,
          req.user!.id,
          basename(file.originalname).slice(0, 255),
          key,
          mime,
          file.size,
          content,
        ],
      );
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
    res.status(201).json({ id, name: basename(file.originalname), content });
  },
);
