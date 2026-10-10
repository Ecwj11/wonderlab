import { randomUUID } from 'node:crypto';
import type { User, LessonDefinition, ProgressStats } from '@wonderlab/shared';
import { rows, run, type Db } from '../db/pool.js';
import { awardLearningStars, type LearningStarEvent } from './rewards.js';
function localDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export async function awardXp(
  userId: string,
  lessonId: string,
  key: string,
  amount: number,
  reason: string,
  db: Db,
  starEvent?: LearningStarEvent,
) {
  const result = await run(
    'INSERT IGNORE INTO user_xp_transactions(id,user_id,lesson_id,reward_key,amount,reason) VALUES(?,?,?,?,?,?)',
    [randomUUID(), userId, lessonId, key, amount, reason],
    db,
  );
  if (result.affectedRows) {
    await run('UPDATE users SET xp=xp+? WHERE id=?', [amount, userId], db);
    if (starEvent) await awardLearningStars(userId, lessonId, key, starEvent, db);
  }
  return result.affectedRows ? amount : 0;
}
async function touchStreak(user: User, db: Db) {
  const today = localDate(new Date(), user.timezone);
  const yesterday = new Date(today + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prior = yesterday.toISOString().slice(0, 10);
  const [row] = await rows<{
    current_streak: number;
    longest_streak: number;
    last_date: string | null;
  }>(
    "SELECT current_streak,longest_streak,DATE_FORMAT(last_learning_date,'%Y-%m-%d') last_date FROM learning_streaks WHERE user_id=? FOR UPDATE",
    [user.id],
    db,
  );
  if (row?.last_date === today) return;
  const streak = row?.last_date === prior ? row.current_streak + 1 : 1;
  await run(
    'INSERT INTO learning_streaks(id,user_id,current_streak,longest_streak,last_learning_date) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE current_streak=VALUES(current_streak),longest_streak=GREATEST(longest_streak,VALUES(longest_streak)),last_learning_date=VALUES(last_learning_date)',
    [randomUUID(), user.id, streak, streak, today],
    db,
  );
}
export async function refreshAchievements(userId: string, db: Db) {
  const [{ completed }] = await rows<{ completed: number }>(
    "SELECT COUNT(*) completed FROM lesson_progress WHERE user_id=? AND status='COMPLETED'",
    [userId],
    db,
  );
  const [{ xp }] = await rows<{ xp: number }>('SELECT xp FROM users WHERE id=?', [userId], db);
  const [streak] = await rows<{ current_streak: number }>(
    'SELECT current_streak FROM learning_streaks WHERE user_id=?',
    [userId],
    db,
  );
  const [{ perfect }] = await rows<{ perfect: number }>(
    'SELECT COUNT(*) perfect FROM quiz_attempts WHERE user_id=? AND score=100',
    [userId],
    db,
  );
  const ids = [
    ...(completed >= 1 ? ['first-lesson'] : []),
    ...(completed >= 5 ? ['five-lessons'] : []),
    ...(xp >= 1000 ? ['thousand-xp'] : []),
    ...(streak?.current_streak >= 3 ? ['three-days'] : []),
    ...(perfect ? ['perfect-quiz'] : []),
  ];
  for (const id of ids)
    await run(
      'INSERT IGNORE INTO user_achievements(id,user_id,achievement_id) VALUES(?,?,?)',
      [randomUUID(), userId, id],
      db,
    );
}
export async function completeScene(
  user: User,
  lessonId: string,
  sceneId: string,
  definition: LessonDefinition,
  elapsedSeconds: number,
  db: Db,
) {
  const inserted = await run(
    'INSERT IGNORE INTO scene_progress(id,user_id,lesson_id,scene_key,elapsed_seconds) VALUES(?,?,?,?,?)',
    [randomUUID(), user.id, lessonId, sceneId, elapsedSeconds],
    db,
  );
  const [{ count }] = await rows<{ count: number }>(
    'SELECT COUNT(*) count FROM scene_progress WHERE user_id=? AND lesson_id=?',
    [user.id, lessonId],
    db,
  );
  const progress = Math.min(100, Math.floor((count / definition.scenes.length) * 100));
  const completed = count >= definition.scenes.length;
  await run(
    'INSERT INTO lesson_progress(id,user_id,lesson_id,progress,learning_seconds,status,completed_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE progress=VALUES(progress),learning_seconds=learning_seconds+VALUES(learning_seconds),status=VALUES(status),completed_at=COALESCE(completed_at,VALUES(completed_at))',
    [
      randomUUID(),
      user.id,
      lessonId,
      progress,
      inserted.affectedRows ? elapsedSeconds : 0,
      completed ? 'COMPLETED' : 'IN_PROGRESS',
      completed ? new Date() : null,
    ],
    db,
  );
  let xpEarned = 0;
  if (completed)
    xpEarned = await awardXp(
      user.id,
      lessonId,
      'complete:' + lessonId,
      50,
      'Lesson completed',
      db,
      { kind: 'LESSON' },
    );
  if (inserted.affectedRows) await touchStreak(user, db);
  await refreshAchievements(user.id, db);
  return { progress, lessonCompleted: completed, xpEarned };
}
export async function getStats(user: User): Promise<ProgressStats> {
  const [{ completed, averageScore, learningMinutes }] = await rows<{
    completed: number;
    averageScore: number;
    learningMinutes: number;
  }>(
    "SELECT COALESCE(SUM(status='COMPLETED'),0) completed,COALESCE(AVG(best_score),0) averageScore,COALESCE(SUM(learning_seconds)/60,0) learningMinutes FROM lesson_progress WHERE user_id=?",
    [user.id],
  );
  const [streak] = await rows<{
    current_streak: number;
    longest_streak: number;
    last_date: string;
  }>(
    "SELECT current_streak,longest_streak,DATE_FORMAT(last_learning_date,'%Y-%m-%d') last_date FROM learning_streaks WHERE user_id=?",
    [user.id],
  );
  const today = localDate(new Date(), user.timezone);
  const difference = streak ? (Date.parse(today) - Date.parse(streak.last_date)) / 86400000 : 99;
  const subjects = await rows<{
    subject: ProgressStats['subjectProgress'][number]['subject'];
    completed: number;
    total: number;
  }>(
    "SELECT s.id subject,COALESCE(SUM(p.status='COMPLETED'),0) completed,COUNT(l.id) total FROM subjects s LEFT JOIN lessons l ON l.subject_id=s.id AND l.user_id=? LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=? GROUP BY s.id ORDER BY s.name",
    [user.id, user.id],
  );
  const offset =
    new Intl.DateTimeFormat('en', { timeZone: user.timezone, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+00:00';
  const [{ minutesToday }] = await rows<{ minutesToday: number }>(
    "SELECT COALESCE(SUM(elapsed_seconds)/60,0) minutesToday FROM scene_progress WHERE user_id=? AND DATE(CONVERT_TZ(completed_at,'+00:00',?))=?",
    [user.id, offset, today],
  );
  const activity = await rows<{ date: string; xp: number }>(
    "SELECT DATE_FORMAT(CONVERT_TZ(created_at,'+00:00',?), '%Y-%m-%d') date,SUM(amount) xp FROM user_xp_transactions WHERE user_id=? AND created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY GROUP BY date ORDER BY date",
    [
      new Intl.DateTimeFormat('en', { timeZone: user.timezone, timeZoneName: 'longOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')
        ?.value.replace('GMT', '') || '+00:00',
      user.id,
    ],
  );
  return {
    xp: user.xp,
    level: user.level,
    completed: Number(completed),
    averageScore: Math.round(averageScore),
    learningMinutes: Math.round(learningMinutes),
    learningTodayMinutes: Math.floor(minutesToday),
    streak: difference <= 1 ? streak?.current_streak || 0 : 0,
    longestStreak: streak?.longest_streak || 0,
    subjectProgress: subjects.map((s) => ({
      ...s,
      completed: Number(s.completed),
      percentage: s.total ? Math.round((Number(s.completed) / s.total) * 100) : 0,
    })),
    activity,
  };
}
