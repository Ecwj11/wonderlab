import { ApiError } from '../http.js';
import { assertLearning } from '../services/family.js';
import { Router } from 'express';
import { z } from '@wonderlab/shared';
import { authenticate } from '../auth.js';
import { rows, run } from '../db/pool.js';
import { config } from '../config.js';
import { listLessons, getLesson, lessonAccess, duplicateLesson } from '../services/lessons.js';
import { generateLesson, getJob, regenerateLesson } from '../services/jobs.js';
import { getSettings } from '../services/settings.js';
import { getAppearance } from '../services/appearance.js';
import { getUserPreferences, saveUserPreferences } from '../services/preferences.js';
import { getStats } from '../services/gamification.js';
import {
  recordProgress,
  submitQuiz,
  checkQuizAnswer,
  checkStoryAnswer,
  getStoryState,
} from '../services/learning.js';
export const studentRouter = Router();
studentRouter.use(authenticate);
studentRouter.get('/preferences', async (req, res) =>
  res.json(await getUserPreferences(req.user!.id)),
);
studentRouter.patch('/preferences', async (req, res) =>
  res.json(await saveUserPreferences(req.user!.id, req.body)),
);
studentRouter.get('/appearance', async (_req, res) => res.json(await getAppearance()));
studentRouter.get('/dashboard', async (req, res) => {
  const [stats, recent, recommended, continuing] = await Promise.all([
    getStats(req.user!),
    listLessons(req.user!.id, { pageSize: 6 }),
    listLessons(req.user!.id, { pageSize: 4 }, 'library'),
    listLessons(req.user!.id, { pageSize: 1, status: 'IN_PROGRESS' }),
  ]);
  res.json({
    user: req.user,
    stats,
    recent: recent.data,
    continueLearning: continuing.data[0] || null,
    recommended: recommended.data,
    provider: config.AI_PROVIDER,
    dailyGoalMinutes: (await getSettings()).dailyGoalMinutes,
  });
});
studentRouter.post('/lessons/generate', async (req, res) =>
  res.status(202).json(await generateLesson(req.user!, req.body)),
);
studentRouter.get('/lessons', async (req, res) =>
  res.json(await listLessons(req.user!.id, req.query)),
);
studentRouter.get('/lessons/:id', async (req, res) =>
  res.json(await getLesson(String(req.params.id), req.user!)),
);
const metadata = z
  .strictObject({
    title: z.string().trim().min(1).max(180).optional(),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional(),
  })
  .refine((v) => v.title || v.visibility, 'Provide a title or visibility');
studentRouter.patch('/lessons/:id', async (req, res) => {
  const id = String(req.params.id);
  const lesson = await lessonAccess(id, req.user!, true);
  const input = metadata.parse(req.body);
  if (req.user!.accountType === 'CHILD' && input.visibility && input.visibility !== 'PRIVATE')
    throw new ApiError(403, 'CHILD_SHARING_RESTRICTED', 'Ask your parent to share a lesson.');
  await run('UPDATE lessons SET title=?,visibility=? WHERE id=?', [
    input.title || lesson.title,
    input.visibility || lesson.visibility,
    id,
  ]);
  res.json(await getLesson(id, req.user!));
});
studentRouter.delete('/lessons/:id', async (req, res) => {
  const id = String(req.params.id);
  await lessonAccess(id, req.user!, true);
  await run('DELETE FROM lessons WHERE id=?', [id]);
  res.status(204).end();
});
studentRouter.post('/lessons/:id/duplicate', async (req, res) =>
  res.status(201).json(await duplicateLesson(String(req.params.id), req.user!)),
);
studentRouter.get('/lessons/:id/progress', async (req, res) => {
  const lesson = await getLesson(String(req.params.id), req.user!);
  res.json({
    progress: lesson.progress,
    status: lesson.progressStatus,
    completedScenes: lesson.completedScenes,
    bestScore: lesson.bestScore,
  });
});
studentRouter.post('/lessons/:id/progress', async (req, res) =>
  res.json(await recordProgress(req.user!, String(req.params.id), req.body)),
);
studentRouter.post('/lessons/:id/quiz/submit', async (req, res) =>
  res.json(await submitQuiz(req.user!, String(req.params.id), req.body)),
);
studentRouter.get('/generation-jobs/:id', async (req, res) =>
  res.json(await getJob(String(req.params.id), req.user!)),
);
studentRouter.get('/library', async (req, res) =>
  res.json(await listLessons(req.user!.id, req.query, 'library')),
);
studentRouter.get('/progress', async (req, res) => {
  await assertLearning(req.user!);
  res.json(await getStats(req.user!));
});
studentRouter.get('/achievements', async (req, res) =>
  res.json(
    await rows(
      'SELECT a.*,ua.earned_at earnedAt FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=? ORDER BY a.threshold',
      [req.user!.id],
    ),
  ),
);
studentRouter.get('/subjects', async (_req, res) =>
  res.json(await rows('SELECT * FROM subjects ORDER BY name')),
);

studentRouter.post('/lessons/:id/quiz/check', async (req, res) =>
  res.json(await checkQuizAnswer(req.user!, String(req.params.id), req.body)),
);

studentRouter.post('/lessons/:id/regenerate', async (req, res) =>
  res.status(202).json(await regenerateLesson(String(req.params.id), req.user!)),
);

studentRouter.post('/lessons/:id/story/check', async (req, res) =>
  res.json(await checkStoryAnswer(req.user!, String(req.params.id), req.body)),
);
studentRouter.get('/lessons/:id/story/state', async (req, res) =>
  res.json(await getStoryState(req.user!, String(req.params.id), req.query)),
);
