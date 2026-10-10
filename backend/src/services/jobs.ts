import { assertLessonCreator } from './lesson-permissions.js';
import { randomUUID } from 'node:crypto';
import {
  generateLessonSchema,
  type GenerateInput,
  type GenerationJob,
  type GenerationAgentTask,
  type User,
} from '@wonderlab/shared';
import { rows, run, transaction } from '../db/pool.js';
import { config } from '../config.js';
import { getSettings } from './settings.js';
import { createProvider, assertProviderConfigured } from '../providers/index.js';
import { saveDefinition, lessonAccess } from './lessons.js';
import { getUser } from '../auth.js';
import { reserveFamilyGeneration, assertLearning, familyForUser } from './family.js';
import { ApiError } from '../http.js';
import { generateWithAgents, type AgentLifecycle } from './agent-generation.js';
export interface JobQueue {
  enqueue(user: User, input: GenerateInput): Promise<{ lessonId: string; jobId: string }>;
  claim(): Promise<ClaimedJob | null>;
}
interface ClaimedJob {
  attempts: number;
  id: string;
  user_id: string;
  lesson_id: string;
  input_content: string;
  title: string;
  subject_id: GenerateInput['subject'];
  language: GenerateInput['language'];
  school_level: string;
  input_type: GenerateInput['inputType'];
}
export class MysqlJobQueue implements JobQueue {
  async enqueue(user: User, input: GenerateInput) {
    assertLessonCreator(user);
    assertProviderConfigured();
    const lessonId = randomUUID(),
      jobId = randomUUID();
    const settings = await getSettings();
    await transaction(async (db) => {
      await rows('SELECT id FROM users WHERE id=? FOR UPDATE', [user.id], db);
      const familyId = await reserveFamilyGeneration(user, input.subject, db);
      const [{ count }] = await rows<{ count: number }>(
        'SELECT COUNT(*) count FROM generation_jobs WHERE user_id=? AND created_at>=UTC_DATE()',
        [user.id],
        db,
      );
      if (count >= settings.maxDailyGenerations)
        throw new ApiError(
          429,
          'DAILY_LIMIT',
          'You’ve used your daily generation allowance. Explore your existing lessons and try again tomorrow.',
        );
      await run(
        'INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,source_content,input_type,current_job_id) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          lessonId,
          user.id,
          input.title,
          input.subject,
          input.language,
          input.schoolLevel,
          input.content,
          input.inputType,
          jobId,
        ],
        db,
      );
      await run(
        'INSERT INTO generation_jobs(id,user_id,lesson_id,input_type,input_content,provider,model,family_id) VALUES(?,?,?,?,?,?,?,?)',
        [
          jobId,
          user.id,
          lessonId,
          input.inputType,
          input.content,
          config.AI_PROVIDER,
          config.AI_MODEL || (config.AI_PROVIDER === 'mock' ? 'wonderlab-demo-v1' : null),
          familyId,
        ],
        db,
      );
    });
    return { lessonId, jobId };
  }
  async claim() {
    return transaction(async (db) => {
      await run(
        "UPDATE generation_agent_tasks a JOIN generation_jobs j ON j.id=a.job_id SET a.status='CANCELLED',a.current_step='Worker lease expired',a.completed_at=UTC_TIMESTAMP(3) WHERE j.status='PROCESSING' AND j.heartbeat_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE AND a.attempt=j.attempts AND a.status IN ('PENDING','PROCESSING')",
        [],
        db,
      );
      const exhausted = await rows<{
        id: string;
        user_id: string;
        provider: string;
        model: string | null;
      }>(
        "SELECT id,user_id,provider,model FROM generation_jobs WHERE status='PROCESSING' AND attempts>=3 AND heartbeat_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE FOR UPDATE SKIP LOCKED",
        [],
        db,
      );
      for (const interrupted of exhausted) {
        const [usage] = await rows<{
          tokensInput: number;
          tokensOutput: number;
          estimatedCost: number;
        }>(
          'SELECT COALESCE(SUM(tokens_input),0) tokensInput,COALESCE(SUM(tokens_output),0) tokensOutput,COALESCE(SUM(estimated_cost),0) estimatedCost FROM generation_agent_tasks WHERE job_id=?',
          [interrupted.id],
          db,
        );
        await run(
          "UPDATE generation_jobs SET status='FAILED',error_message='Generation was interrupted repeatedly. Please generate a new lesson.',current_step='Generation stopped after repeated interruptions',completed_at=UTC_TIMESTAMP(3),tokens_input=?,tokens_output=?,estimated_cost=? WHERE id=?",
          [usage.tokensInput, usage.tokensOutput, usage.estimatedCost, interrupted.id],
          db,
        );
        // The job lock and terminal status fence serialize recovery; the extra guard
        // also prevents duplicate usage if an existing terminal record was retained.
        await run(
          'INSERT INTO ai_usage(id,job_id,user_id,provider,model,tokens_input,tokens_output,estimated_cost) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM ai_usage WHERE job_id=?)',
          [
            randomUUID(),
            interrupted.id,
            interrupted.user_id,
            interrupted.provider,
            interrupted.model,
            usage.tokensInput,
            usage.tokensOutput,
            usage.estimatedCost,
            interrupted.id,
          ],
          db,
        );
      }
      await run(
        "UPDATE generation_jobs SET status='PENDING',error_message=NULL,current_step='Recovering interrupted job' WHERE status='PROCESSING' AND attempts<3 AND heartbeat_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE",
        [],
        db,
      );
      await run(
        "UPDATE lessons l JOIN generation_jobs j ON j.lesson_id=l.id SET l.status='FAILED' WHERE j.status='FAILED' AND l.status='GENERATING' AND l.current_job_id=j.id",
        [],
        db,
      );
      const [job] = await rows<ClaimedJob>(
        "SELECT j.attempts,j.id,j.user_id,j.lesson_id,j.input_content,j.input_type,l.title,l.subject_id,l.language,l.school_level FROM generation_jobs j JOIN lessons l ON l.id=j.lesson_id WHERE j.status='PENDING' AND l.current_job_id=j.id ORDER BY j.created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
        [],
        db,
      );
      if (!job) return null;
      await run(
        "UPDATE generation_jobs SET status='PROCESSING',started_at=COALESCE(started_at,UTC_TIMESTAMP(3)),heartbeat_at=UTC_TIMESTAMP(3),attempts=attempts+1,progress=5,current_step='Reading your learning material' WHERE id=?",
        [job.id],
        db,
      );
      return { ...job, attempts: job.attempts + 1 };
    });
  }
}
export const jobQueue = new MysqlJobQueue();
export async function generateLesson(user: User, payload: unknown) {
  assertLessonCreator(user);
  const input = generateLessonSchema.parse(payload);
  if (input.uploadId) {
    const [upload] = await rows<{ extracted_content: string; mime_type: string }>(
      'SELECT extracted_content,mime_type FROM uploaded_files WHERE id=? AND user_id=?',
      [input.uploadId, user.id],
    );
    if (!upload) throw new ApiError(400, 'UPLOAD_NOT_FOUND', 'Upload your material again.');
    input.content = upload.extracted_content;
    input.inputType = upload.mime_type === 'application/pdf' ? 'PDF' : 'IMAGE';
  } else if (input.inputType === 'PDF' || input.inputType === 'IMAGE')
    throw new ApiError(400, 'UPLOAD_REQUIRED', 'Choose an uploaded file.');
  return jobQueue.enqueue(user, input);
}
export async function getJob(id: string, user: User): Promise<GenerationJob> {
  const admin = user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN');
  const family = await rows<{ family_id: string }>(
    'SELECT family_id FROM generation_jobs WHERE id=?',
    [id],
  );
  if (!admin) await assertLearning(user);
  const shared = !!user.familyId && family[0]?.family_id === user.familyId;
  const [job] = await rows<GenerationJob>(
    `SELECT id,attempts attempt,lesson_id lessonId,status,progress,current_step step,provider,model,error_message errorMessage,created_at createdAt FROM generation_jobs WHERE id=? ${admin || shared ? '' : 'AND user_id=?'}`,
    [id, ...(admin || shared ? [] : [user.id])],
  );
  if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'This generation job is unavailable.');
  if (!admin && job.lessonId) await lessonAccess(job.lessonId, user);
  job.agents = await rows<GenerationAgentTask>(
    'SELECT id,attempt,role,name,scene_id sceneId,status,progress,current_step step,provider,model,tokens_input tokensInput,tokens_output tokensOutput,estimated_cost estimatedCost,error_message errorMessage,started_at startedAt,completed_at completedAt,created_at createdAt FROM generation_agent_tasks WHERE job_id=? AND attempt=? ORDER BY task_order',
    [job.id, job.attempt],
  );
  return job;
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function processNextJob(delay = 450) {
  const job = await jobQueue.claim();
  if (!job) return false;
  const step = async (progress: number, name: string) => {
    const update = await run(
      "UPDATE generation_jobs SET progress=GREATEST(progress,?),current_step=?,heartbeat_at=UTC_TIMESTAMP(3) WHERE id=? AND attempts=? AND status='PROCESSING'",
      [progress, name, job.id, job.attempts],
    );
    if (!update.affectedRows) throw new Error('Generation lease lost');
    if (delay) await pause(delay);
  };
  let leaseError: Error | null = null;
  let heartbeatWork = Promise.resolve();
  const heartbeat = setInterval(() => {
    heartbeatWork = heartbeatWork
      .then(async () => {
        const result = await run(
          "UPDATE generation_jobs SET heartbeat_at=UTC_TIMESTAMP(3) WHERE id=? AND attempts=? AND status='PROCESSING'",
          [job.id, job.attempts],
        );
        if (!result.affectedRows) leaseError = new Error('Generation lease lost');
      })
      .catch(() => {
        leaseError = new Error('Generation heartbeat failed');
      });
  }, 15000);
  heartbeat.unref();
  const taskUpdate = async (
    id: string,
    status: string,
    name: string,
    usage = { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 },
  ) => {
    if (leaseError) throw leaseError;
    const result = await run(
      "UPDATE generation_agent_tasks a JOIN generation_jobs j ON j.id=a.job_id SET a.status=?,a.current_step=?,a.progress=IF(?='COMPLETED',100,IF(?='PROCESSING',10,a.progress)),a.started_at=IF(?='PROCESSING',COALESCE(a.started_at,UTC_TIMESTAMP(3)),a.started_at),a.completed_at=IF(? IN ('COMPLETED','FAILED'),UTC_TIMESTAMP(3),a.completed_at),a.error_message=IF(?='FAILED','This agent could not prepare its assigned content.',NULL),a.tokens_input=?,a.tokens_output=?,a.estimated_cost=? WHERE a.id=? AND j.id=? AND j.attempts=? AND a.attempt=j.attempts AND j.status='PROCESSING'",
      [
        status,
        name,
        status,
        status,
        status,
        status,
        status,
        usage.tokensInput,
        usage.tokensOutput,
        usage.estimatedCost,
        id,
        job.id,
        job.attempts,
      ],
    );
    if (!result.affectedRows) throw new Error('Generation lease lost');
  };
  const lifecycle: AgentLifecycle = {
    create: async (task) => {
      if (leaseError) throw leaseError;
      const result = await run(
        "INSERT INTO generation_agent_tasks(id,job_id,attempt,task_order,role,name,scene_id,provider,model) SELECT ?,j.id,j.attempts,?,?,?,?,?,? FROM generation_jobs j WHERE j.id=? AND j.attempts=? AND j.status='PROCESSING'",
        [
          task.id,
          task.order,
          task.role,
          task.name,
          task.sceneId,
          task.provider,
          task.model,
          job.id,
          job.attempts,
        ],
      );
      if (!result.affectedRows) throw new Error('Generation lease lost');
    },
    start: (task) =>
      taskUpdate(
        task.id,
        'PROCESSING',
        task.role === 'VALIDATOR'
          ? 'Checking schema and assembling lesson'
          : 'Preparing assigned learning content',
      ),
    complete: (task, usage) => taskUpdate(task.id, 'COMPLETED', 'Assigned task completed', usage),
    fail: (task, usage) => taskUpdate(task.id, 'FAILED', 'Assigned task failed', usage),
    progress: step,
  };
  try {
    const factory = () => createProvider({ jobId: job.id, attempt: job.attempts });
    const provider = factory();
    const metadata = await run(
      "UPDATE generation_jobs SET provider=?,model=? WHERE id=? AND attempts=? AND status='PROCESSING'",
      [provider.name, provider.model, job.id, job.attempts],
    );
    if (!metadata.affectedRows) throw new Error('Generation lease lost');
    const input = generateLessonSchema.parse({
      title: job.title,
      subject: job.subject_id,
      language: job.language,
      schoolLevel: job.school_level,
      content: job.input_content,
      inputType: job.input_type,
    });
    const generated = await generateWithAgents(input, provider, factory, lifecycle);
    if (leaseError) throw leaseError;
    await transaction(async (db) => {
      await rows('SELECT id FROM users WHERE id=? FOR UPDATE', [job.user_id], db);
      const [active] = await rows<{
        status: string;
        attempts: number;
        provider: string;
        model: string | null;
      }>(
        'SELECT status,attempts,provider,model FROM generation_jobs WHERE id=? FOR UPDATE',
        [job.id],
        db,
      );
      if (active?.status !== 'PROCESSING' || active.attempts !== job.attempts) return;
      await rows('SELECT id FROM lessons WHERE id=? FOR UPDATE', [job.lesson_id], db);
      await saveDefinition(job.lesson_id, generated.definition, db);
      const [usage] = await rows<{
        tokensInput: number;
        tokensOutput: number;
        estimatedCost: number;
      }>(
        'SELECT COALESCE(SUM(tokens_input),0) tokensInput,COALESCE(SUM(tokens_output),0) tokensOutput,COALESCE(SUM(estimated_cost),0) estimatedCost FROM generation_agent_tasks WHERE job_id=?',
        [job.id],
        db,
      );
      await run(
        "UPDATE generation_jobs SET status='COMPLETED',progress=100,current_step='Your adventure is ready',provider=?,model=?,tokens_input=?,tokens_output=?,estimated_cost=?,completed_at=UTC_TIMESTAMP(3) WHERE id=?",
        [
          provider.name,
          provider.model,
          usage.tokensInput,
          usage.tokensOutput,
          usage.estimatedCost,
          job.id,
        ],
        db,
      );
      await run(
        'INSERT INTO ai_usage(id,job_id,user_id,provider,model,tokens_input,tokens_output,estimated_cost) VALUES(?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          job.id,
          job.user_id,
          provider.name,
          provider.model,
          usage.tokensInput,
          usage.tokensOutput,
          usage.estimatedCost,
        ],
        db,
      );
    });
  } catch {
    console.error('Generation failed', job.id);
    await transaction(async (db) => {
      await rows('SELECT id FROM users WHERE id=? FOR UPDATE', [job.user_id], db);
      const [active] = await rows<{
        status: string;
        attempts: number;
        provider: string;
        model: string | null;
      }>(
        'SELECT status,attempts,provider,model FROM generation_jobs WHERE id=? FOR UPDATE',
        [job.id],
        db,
      );
      if (active?.status !== 'PROCESSING' || active.attempts !== job.attempts) return;
      await run(
        "UPDATE generation_agent_tasks SET status='CANCELLED',current_step='Cancelled after generation stopped',completed_at=UTC_TIMESTAMP(3) WHERE job_id=? AND attempt=? AND status IN ('PENDING','PROCESSING')",
        [job.id, job.attempts],
        db,
      );
      const [usage] = await rows<{
        tokensInput: number;
        tokensOutput: number;
        estimatedCost: number;
      }>(
        'SELECT COALESCE(SUM(tokens_input),0) tokensInput,COALESCE(SUM(tokens_output),0) tokensOutput,COALESCE(SUM(estimated_cost),0) estimatedCost FROM generation_agent_tasks WHERE job_id=?',
        [job.id],
        db,
      );
      await run(
        'INSERT INTO ai_usage(id,job_id,user_id,provider,model,tokens_input,tokens_output,estimated_cost) VALUES(?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          job.id,
          job.user_id,
          active.provider,
          active.model,
          usage.tokensInput,
          usage.tokensOutput,
          usage.estimatedCost,
        ],
        db,
      );
      await run(
        'UPDATE generation_jobs SET tokens_input=?,tokens_output=?,estimated_cost=? WHERE id=?',
        [usage.tokensInput, usage.tokensOutput, usage.estimatedCost, job.id],
        db,
      );
      await run(
        "UPDATE generation_jobs SET status='FAILED',error_message='We could not prepare this lesson. Try again or contact your teacher.',current_step='Generation failed',completed_at=UTC_TIMESTAMP(3) WHERE id=?",
        [job.id],
        db,
      );
      await run("UPDATE lessons SET status='FAILED' WHERE id=?", [job.lesson_id], db);
    });
  } finally {
    clearInterval(heartbeat);
    await heartbeatWork;
  }
  return true;
}
export function startWorker() {
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      try {
        const processed = await processNextJob();
        if (!processed) await pause(1000);
      } catch (error) {
        console.error('Worker error', error instanceof Error ? error.message : 'Unknown');
        await pause(2000);
      }
    }
  };
  const done = loop();
  return async () => {
    stopped = true;
    await done;
  };
}

export async function regenerateLesson(id: string, user: User) {
  assertLessonCreator(user);
  const lesson = await lessonAccess(id, user, true);
  assertProviderConfigured();
  const jobId = randomUUID();
  const settings = await getSettings();
  await transaction(async (db) => {
    await rows('SELECT id FROM users WHERE id=? FOR UPDATE', [lesson.user_id], db);
    // Acquire the family lock before any consistent read establishes the MySQL snapshot.
    const ownerFamily = await familyForUser(lesson.user_id, db, true);
    const owner = (await getUser(lesson.user_id, db))!;
    // Administrators can repair historical child lessons; creation permission
    // and credits belong to the parent while the original lesson owner is preserved.
    const creator =
      owner.accountType === 'CHILD' && ownerFamily
        ? (await getUser(ownerFamily.parent_id, db))!
        : owner;
    const familyId = await reserveFamilyGeneration(
      creator,
      lesson.subject_id as GenerateInput['subject'],
      db,
    );
    const [{ count }] = await rows<{ count: number }>(
      'SELECT COUNT(*) count FROM generation_jobs WHERE user_id=? AND created_at>=UTC_DATE()',
      [lesson.user_id],
      db,
    );
    if (count >= settings.maxDailyGenerations)
      throw new ApiError(
        429,
        'DAILY_LIMIT',
        'This account has reached its daily generation allowance.',
      );
    const [current] = await rows<{ status: string }>(
      'SELECT status FROM lessons WHERE id=? FOR UPDATE',
      [id],
      db,
    );
    if (current.status === 'GENERATING')
      throw new ApiError(409, 'ALREADY_GENERATING', 'This lesson is already being generated.');
    await run(
      "UPDATE lessons SET status='GENERATING',current_job_id=? WHERE id=?",
      [jobId, id],
      db,
    );
    await run('DELETE FROM scene_progress WHERE lesson_id=?', [id], db);
    await run('DELETE FROM lesson_progress WHERE lesson_id=?', [id], db);
    await run('DELETE FROM quiz_attempts WHERE lesson_id=?', [id], db);
    await run('DELETE FROM quiz_choices WHERE lesson_id=?', [id], db);
    await run(
      'INSERT INTO generation_jobs(id,user_id,lesson_id,input_type,input_content,provider,model,family_id) VALUES(?,?,?,?,?,?,?,?)',
      [
        jobId,
        lesson.user_id,
        id,
        lesson.input_type,
        lesson.source_content,
        config.AI_PROVIDER,
        config.AI_MODEL || null,
        familyId,
      ],
      db,
    );
  });
  return { lessonId: id, jobId };
}
