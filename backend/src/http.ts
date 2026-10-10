import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError, z } from '@wonderlab/shared';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export function pagination(query: unknown) {
  const { page, pageSize } = paginationSchema.parse(query);
  return { page, pageSize, offset: (page - 1) * pageSize };
}
export function paginated<T>(data: T[], total: number, page: number, pageSize: number) {
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
export function errors(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = String(res.locals.requestId || randomUUID());
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues
            .map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`)
            .join('; '),
          requestId,
        },
      });
    return;
  }
  if (error instanceof ApiError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, requestId } });
    return;
  }
  if (typeof error === 'object' && error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    res
      .status(409)
      .json({ error: { code: 'CONFLICT', message: 'This record already exists.', requestId } });
    return;
  }
  console.error(
    JSON.stringify({
      requestId,
      path: req.path,
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  res
    .status(500)
    .json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId,
      },
    });
}
