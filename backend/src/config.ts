import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from '@wonderlab/shared';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab'),
  JWT_SECRET: z.string().min(32).default('local-only-wonderlab-secret-change-in-production'),
  AI_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0),
  AI_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0),
  AI_PROVIDER: z.enum(['mock', 'codex', 'openai', 'anthropic', 'gemini']).default('mock'),
  AI_MODEL: z.string().optional(),
  JOB_WORKER_ENABLED: z.string().default('true'),
  STORAGE_PATH: z.string().default('./storage'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});
export const config = envSchema.parse(process.env);
if (
  config.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || config.JWT_SECRET.startsWith('local-only'))
)
  throw new Error('Production requires an explicit strong JWT_SECRET');
