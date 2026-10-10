import { Router } from 'express';
import { z, type Role } from '@wonderlab/shared';
import { authenticate, requireRoles, getUser } from '../auth.js';
import { config } from '../config.js';
import { rows, run, transaction } from '../db/pool.js';
import { pagination, paginated, ApiError } from '../http.js';
import { listLessons, privateDefinition, lessonAccess } from '../services/lessons.js';
import { getSettings, settingsSchema } from '../services/settings.js';
import { regenerateLesson } from '../services/jobs.js';
import { getAppearance, saveAppearance } from '../services/appearance.js';
export const adminRouter = Router();
adminRouter.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'));
adminRouter.get('/dashboard', async (_req, res) => {
  const [users, lessons, jobs, usage, growth, subjects] = await Promise.all([
    rows(
      'SELECT COUNT(*) totalUsers,SUM(last_login_at>=UTC_TIMESTAMP()-INTERVAL 7 DAY) activeUsers,SUM(created_at>=UTC_TIMESTAMP()-INTERVAL 7 DAY) newUsers FROM users',
    ),
    rows(
      "SELECT COUNT(*) lessonsGenerated,(SELECT COUNT(*) FROM lesson_progress WHERE status='COMPLETED') lessonsCompleted FROM lessons",
    ),
    rows(
      "SELECT COUNT(*) total,SUM(status='COMPLETED') completed,SUM(status='FAILED') failed,SUM(status='PROCESSING' OR status='PENDING') pending FROM generation_jobs",
    ),
    rows(
      "SELECT COALESCE(SUM(CASE WHEN provider<>'codex' THEN tokens_input+tokens_output ELSE 0 END),0) tokens,COALESCE(SUM(CASE WHEN provider<>'codex' THEN estimated_cost ELSE 0 END),0) cost,COALESCE(SUM(provider='codex'),0) unreportedRecords,COALESCE(SUM(provider<>'codex'),0) reportedRecords FROM ai_usage",
    ),
    rows(
      "SELECT DATE_FORMAT(created_at,'%Y-%m-%d') date,COUNT(*) count FROM users GROUP BY date ORDER BY date DESC LIMIT 14",
    ),
    rows(
      'SELECT s.name,COUNT(l.id) count FROM subjects s LEFT JOIN lessons l ON l.subject_id=s.id GROUP BY s.id ORDER BY count DESC',
    ),
  ]);
  res.json({
    users: users[0],
    lessons: lessons[0],
    jobs: jobs[0],
    usage: usage[0],
    growth,
    subjects,
  });
});
adminRouter.get('/users', async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const search = String(req.query.search || '').slice(0, 180);
  const where = search ? 'WHERE u.name LIKE ? OR u.email LIKE ?' : '';
  const params = search ? ['%' + search + '%', '%' + search + '%'] : [];
  const data = await rows(
    `SELECT u.id,u.name,u.email,u.status,u.xp,FLOOR(u.xp/500)+1 level,u.created_at createdAt,u.last_login_at lastLogin,(SELECT GROUP_CONCAT(role_id) FROM user_roles WHERE user_id=u.id) roles,(SELECT COUNT(*) FROM lessons WHERE user_id=u.id) lessonsGenerated FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const [{ total }] = await rows<{ total: number }>(
    `SELECT COUNT(*) total FROM users u ${where}`,
    params,
  );
  res.json(paginated(data, total, page, pageSize));
});
adminRouter.get('/users/:id', async (req, res) => {
  const user = await getUser(String(req.params.id));
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  res.json(user);
});
adminRouter.patch('/users/:id', async (req, res) => {
  const input = z
    .strictObject({
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      role: z.enum(['STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
    })
    .refine((v) => v.status || v.role, 'Provide a status or role')
    .parse(req.body);
  const id = String(req.params.id);
  const target = await getUser(id);
  if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  if (input.role && (target.familyId || input.role === 'PARENT'))
    throw new ApiError(
      400,
      'FAMILY_ROLE_PROTECTED',
      'Family roles are managed through family accounts.',
    );
  if (id === req.user!.id)
    throw new ApiError(400, 'SELF_CHANGE', 'Ask another administrator to change your access.');
  const privileged = (role: Role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
  if (
    !req.user!.roles.includes('SUPER_ADMIN') &&
    (target.roles.some(privileged) || (input.role && privileged(input.role)))
  )
    throw new ApiError(
      403,
      'SUPER_ADMIN_REQUIRED',
      'A super administrator must change admin access.',
    );
  await transaction(async (db) => {
    if (input.status) await run('UPDATE users SET status=? WHERE id=?', [input.status, id], db);
    if (input.role) {
      await run('DELETE FROM user_roles WHERE user_id=?', [id], db);
      await run('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)', [id, input.role], db);
    }
  });
  res.json(await getUser(id));
});
adminRouter.get('/lessons', async (req, res) =>
  res.json(await listLessons(req.user!.id, req.query, 'admin')),
);
adminRouter.get('/lessons/:id/json', async (req, res) => {
  await lessonAccess(String(req.params.id), req.user!);
  res.json(await privateDefinition(String(req.params.id)));
});
adminRouter.patch('/lessons/:id', async (req, res) => {
  const input = z
    .strictObject({
      title: z.string().trim().min(1).max(180).optional(),
      visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional(),
    })
    .parse(req.body);
  const lesson = await lessonAccess(String(req.params.id), req.user!, true);
  await run('UPDATE lessons SET title=?,visibility=? WHERE id=?', [
    input.title || lesson.title,
    input.visibility || lesson.visibility,
    lesson.id,
  ]);
  res.json({ success: true });
});
adminRouter.delete('/lessons/:id', async (req, res) => {
  await lessonAccess(String(req.params.id), req.user!, true);
  await run('DELETE FROM lessons WHERE id=?', [req.params.id]);
  res.status(204).end();
});
adminRouter.post('/lessons/:id/regenerate', async (req, res) =>
  res.status(202).json(await regenerateLesson(String(req.params.id), req.user!)),
);
adminRouter.get('/generation-jobs', async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const data = await rows(
    'SELECT j.id,j.lesson_id lessonId,j.user_id userId,l.title,j.status,j.progress,j.current_step step,j.provider,j.model,j.tokens_input tokensInput,j.tokens_output tokensOutput,j.estimated_cost estimatedCost,j.error_message errorMessage,j.created_at createdAt FROM generation_jobs j LEFT JOIN lessons l ON l.id=j.lesson_id ORDER BY j.created_at DESC LIMIT ? OFFSET ?',
    [pageSize, offset],
  );
  const [{ total }] = await rows<{ total: number }>('SELECT COUNT(*) total FROM generation_jobs');
  res.json(paginated(data, total, page, pageSize));
});
adminRouter.get('/config', (_req, res) =>
  res.json({
    provider: config.AI_PROVIDER,
    model: config.AI_MODEL || 'Provider default',
    providers: [
      { name: 'mock', configured: true },
      { name: 'codex', configured: true },
      { name: 'openai', configured: !!config.OPENAI_API_KEY },
      { name: 'anthropic', configured: !!config.ANTHROPIC_API_KEY },
      { name: 'gemini', configured: !!config.GEMINI_API_KEY },
    ],
    workerEnabled: config.JOB_WORKER_ENABLED === 'true',
    schemaVersion: 1,
  }),
);
adminRouter.get('/usage', async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const data = await rows(
    'SELECT a.*,u.name userName FROM ai_usage a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT ? OFFSET ?',
    [pageSize, offset],
  );
  const [{ total }] = await rows<{ total: number }>('SELECT COUNT(*) total FROM ai_usage');
  res.json(paginated(data, total, page, pageSize));
});

adminRouter.get('/settings', async (_req, res) => res.json(await getSettings()));
adminRouter.get('/appearance', async (_req, res) => res.json(await getAppearance()));
adminRouter.patch('/appearance', async (req, res) => res.json(await saveAppearance(req.body)));
adminRouter.patch('/settings', async (req, res) => {
  const settings = settingsSchema.parse(req.body);
  await run(
    "INSERT INTO system_settings(id,value) VALUES('learning',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
    [JSON.stringify(settings)],
  );
  res.json(settings);
});
adminRouter.get('/subjects', async (_req, res) =>
  res.json(
    await rows(
      'SELECT s.id,s.name,s.color,COUNT(l.id) lessons FROM subjects s LEFT JOIN lessons l ON l.subject_id=s.id GROUP BY s.id ORDER BY s.name',
    ),
  ),
);
