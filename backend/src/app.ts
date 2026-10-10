import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { createHash } from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { authRouter } from './auth.js';
import { familyRouter, familyAdminRouter } from './routes/family.js';
import { rewardsRouter } from './routes/rewards.js';
import { studentRouter } from './routes/student.js';
import { uploadsRouter } from './routes/uploads.js';
import { adminRouter } from './routes/admin.js';
import { errors } from './http.js';
import { rows } from './db/pool.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 300,
      keyGenerator: (req) => {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (token) {
          try {
            const verified = jwt.verify(token, config.JWT_SECRET, {
              algorithms: ['HS256'],
              issuer: 'wonderlab',
              audience: 'wonderlab-api',
            }) as jwt.JwtPayload;
            return 'user:' + verified.sub;
          } catch {
            /* Invalid tokens use the anonymous IP budget. */
          }
        }
        return ipKeyGenerator(req.ip || '127.0.0.1');
      },
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', async (_req, res) => {
    await rows('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use(
    [
      '/auth/login',
      '/auth/register',
      '/auth/admin/login',
      '/auth/parent/login',
      '/auth/parent/register',
      '/auth/child/login',
    ],
    rateLimit({
      windowMs: 900000,
      limit: 20,
      keyGenerator: (req) =>
        createHash('sha256')
          .update(
            String(
              req.body?.email || (req.body?.familyCode || '') + ':' + (req.body?.username || ''),
            )
              .toLowerCase()
              .slice(0, 254),
          )
          .digest('hex'),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many sign-in attempts for this account. Try again in 15 minutes.',
        },
      },
    }),
  );
  app.use('/auth', authRouter);
  app.use(uploadsRouter);
  app.use('/admin', familyAdminRouter);
  app.use('/admin', adminRouter);
  app.use(rewardsRouter);
  app.use(familyRouter);
  app.use(studentRouter);
  app.use((_req, res) =>
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'This endpoint does not exist.',
        requestId: res.locals.requestId,
      },
    }),
  );
  app.use(errors);
  return app;
}
