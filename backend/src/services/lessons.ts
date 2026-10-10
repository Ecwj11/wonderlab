import { randomUUID } from 'node:crypto';
import {
  lessonSchema,
  publicDefinition,
  isSchoolLevelAllowed,
  type LessonDefinition,
  type LessonDetail,
  type LessonSummary,
  type User,
} from '@wonderlab/shared';
import { rows, run, transaction, type Db } from '../db/pool.js';
import { getUser } from '../auth.js';
import { familyForUser, assertLearning } from './family.js';
import { ApiError, pagination, paginated } from '../http.js';
export const summarySelect = `SELECT l.id,l.user_id userId,l.title,l.subject_id subject,l.language,l.school_level schoolLevel,l.visibility,l.status,l.schema_version schemaVersion,l.created_at createdAt,u.name ownerName,COALESCE(p.progress,0) progress,p.best_score bestScore,p.status progressStatus,(SELECT COUNT(*) FROM lesson_scenes s JOIN lesson_versions v ON s.lesson_version_id=v.id WHERE v.lesson_id=l.id AND v.version=(SELECT MAX(version) FROM lesson_versions WHERE lesson_id=l.id)) sceneCount FROM lessons l JOIN users u ON u.id=l.user_id LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=?`;
export async function listLessons(
  userId: string,
  query: Record<string, unknown>,
  scope: 'own' | 'library' | 'admin' = 'own',
) {
  const { page, pageSize, offset } = pagination(query);
  let where =
    scope === 'own'
      ? 'l.user_id=?'
      : scope === 'library'
        ? "l.visibility='PUBLIC' AND l.status='READY'"
        : '1=1';
  const values: unknown[] = scope === 'own' ? [userId] : [];
  const user = await getUser(userId);
  if (user && scope !== 'admin') {
    const access = await assertLearning(user);
    if (access.familyId && scope === 'own') {
      where =
        '(l.user_id=? OR l.user_id IN (SELECT parent_id FROM families WHERE id=?) OR l.user_id IN (SELECT user_id FROM family_children WHERE family_id=?))';
      values.push(access.familyId, access.familyId);
    }
    if (user.accountType === 'CHILD') {
      where += ' AND l.subject_id IN (' + access.allowedSubjects.map(() => '?').join(',') + ')';
      values.push(...access.allowedSubjects);
      if (access.allowedSchoolLevels !== null) {
        // Resolve legacy grade labels using the same rules as direct access, then
        // filter in SQL so counts and pagination never include blocked lessons.
        const levels = await rows<{ schoolLevel: string }>(
          'SELECT DISTINCT school_level schoolLevel FROM lessons',
        );
        const allowedLevels = levels
          .filter((level) => isSchoolLevelAllowed(level.schoolLevel, access.allowedSchoolLevels))
          .map((level) => level.schoolLevel);
        where += allowedLevels.length
          ? ' AND l.school_level IN (' + allowedLevels.map(() => '?').join(',') + ')'
          : ' AND 1=0';
        values.push(...allowedLevels);
      }
    }
  }
  if (query.subject && query.subject !== 'ALL') {
    where += ' AND l.subject_id=?';
    values.push(query.subject);
  }
  if (query.visibility && scope === 'admin') {
    where += ' AND l.visibility=?';
    values.push(query.visibility);
  }
  if (query.language) {
    where += ' AND l.language=?';
    values.push(query.language);
  }
  if (query.schoolLevel) {
    where += ' AND l.school_level=?';
    values.push(query.schoolLevel);
  }
  if (query.status) {
    if (query.status === 'READY' && scope === 'own') {
      where += " AND l.status='READY' AND p.status IS NULL AND COALESCE(p.progress,0)=0";
    } else if (query.status === 'COMPLETED') {
      where += ' AND p.status=?';
      values.push('COMPLETED');
    } else if (query.status === 'IN_PROGRESS') {
      where += " AND p.status='IN_PROGRESS'";
    } else {
      where += ' AND l.status=?';
      values.push(query.status);
    }
  }
  if (query.search) {
    where += ' AND l.title LIKE ?';
    values.push('%' + String(query.search).slice(0, 180) + '%');
  }
  const data = await rows<LessonSummary>(
    `${summarySelect} WHERE ${where} ORDER BY ${query.sort === 'popular' ? '(SELECT COUNT(*) FROM lesson_progress lp WHERE lp.lesson_id=l.id) DESC,' : ''} l.created_at DESC LIMIT ? OFFSET ?`,
    [userId, ...values, pageSize, offset],
  );
  const [{ total }] = await rows<{ total: number }>(
    `SELECT COUNT(*) total FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=? WHERE ${where}`,
    [userId, ...values],
  );
  return paginated(data, total, page, pageSize);
}
export async function lessonAccess(id: string, user: User, write = false, db?: Db) {
  const [lesson] = await rows<{
    id: string;
    user_id: string;
    visibility: string;
    status: string;
    title: string;
    subject_id: string;
    language: string;
    school_level: string;
    source_content: string;
    input_type: string;
  }>('SELECT * FROM lessons WHERE id=?', [id], db);
  const admin = user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN');
  const memberFamily = await familyForUser(user.id, db);
  const ownerFamily = lesson ? await familyForUser(lesson.user_id, db) : null;
  const sameFamily = !!memberFamily && ownerFamily?.id === memberFamily.id;
  if (
    !lesson ||
    (!admin &&
      lesson.user_id !== user.id &&
      (write || (!sameFamily && !['PUBLIC', 'UNLISTED'].includes(lesson.visibility))))
  )
    throw new ApiError(404, 'LESSON_NOT_FOUND', 'This lesson is unavailable.');
  if (!admin) {
    const access = await assertLearning(user, lesson.subject_id, false, db);
    if (
      user.accountType === 'CHILD' &&
      !isSchoolLevelAllowed(lesson.school_level, access.allowedSchoolLevels)
    )
      throw new ApiError(403, 'GRADE_RESTRICTED', 'Ask your parent to allow this lesson grade.');
  }
  return lesson;
}
export async function privateDefinition(id: string, db?: Db): Promise<LessonDefinition> {
  const [row] = await rows<{ definition: unknown }>(
    'SELECT definition FROM lesson_versions WHERE lesson_id=? ORDER BY version DESC LIMIT 1',
    [id],
    db,
  );
  if (!row) throw new ApiError(409, 'LESSON_NOT_READY', 'Your lesson is still being prepared.');
  return lessonSchema.parse(
    typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition,
  );
}
export async function getLesson(id: string, user: User): Promise<LessonDetail> {
  const lesson = await lessonAccess(id, user);
  const [summary] = await rows<LessonSummary>(`${summarySelect} WHERE l.id=?`, [user.id, id]);
  const completed = await rows<{ scene_key: string }>(
    'SELECT scene_key FROM scene_progress WHERE user_id=? AND lesson_id=?',
    [user.id, id],
  );
  const [{ lessonVersion }] = await rows<{ lessonVersion: number }>(
    'SELECT COALESCE(MAX(version),0) lessonVersion FROM lesson_versions WHERE lesson_id=?',
    [id],
  );
  return {
    ...summary,
    lessonVersion,
    definition: lesson.status === 'READY' ? publicDefinition(await privateDefinition(id)) : null,
    completedScenes: completed.map((s) => s.scene_key),
  };
}
export async function saveDefinition(id: string, definition: LessonDefinition, db: Db) {
  const valid = lessonSchema.parse(definition);
  const [current] = await rows<{ version: number }>(
    'SELECT COALESCE(MAX(version),0) version FROM lesson_versions WHERE lesson_id=?',
    [id],
    db,
  );
  const versionId = randomUUID();
  await run(
    'INSERT INTO lesson_versions(id,lesson_id,version,definition) VALUES(?,?,?,?)',
    [versionId, id, current.version + 1, JSON.stringify(valid)],
    db,
  );
  for (const [i, s] of valid.scenes.entries())
    await run(
      'INSERT INTO lesson_scenes(id,lesson_version_id,scene_key,scene_type,position) VALUES(?,?,?,?,?)',
      [randomUUID(), versionId, s.id, s.type, i],
      db,
    );
  await run("UPDATE lessons SET status='READY',schema_version=1 WHERE id=?", [id], db);
}
export async function duplicateLesson(id: string, user: User) {
  const lesson = await lessonAccess(id, user);
  const definition = await privateDefinition(id);
  const newId = randomUUID();
  await transaction(async (db) => {
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content,input_type) VALUES(?,?,?,?,?,?,'PRIVATE','READY',?,?)",
      [
        newId,
        user.id,
        lesson.title,
        lesson.subject_id,
        lesson.language,
        lesson.school_level,
        lesson.source_content,
        lesson.input_type,
      ],
      db,
    );
    await saveDefinition(newId, definition, db);
  });
  return { id: newId };
}
