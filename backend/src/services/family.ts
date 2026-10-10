import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  childCreateSchema,
  childUpdateSchema,
  planInputSchema,
  z,
  type User,
  type LearningAccess,
  type FamilySummary,
  type SubscriptionPlan,
  type FamilySubscription,
  type FamilyChild,
  type FamilyDashboard,
  type FamilyBilling,
  type AdminFamily,
  type Subject,
  type SchoolGrade,
} from '@wonderlab/shared';
import { rows, run, transaction, type Db } from '../db/pool.js';
import { ApiError, pagination, paginated } from '../http.js';
import { getUser } from '../auth.js';
import { getStats } from './gamification.js';
const subjects: Subject[] = ['MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'GENERAL'];
const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
const json = <T>(value: T | string): T => (typeof value === 'string' ? JSON.parse(value) : value);
interface FamilyRow {
  id: string;
  parent_id: string;
  name: string;
  code: string;
  status: FamilySummary['status'];
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  trial_child_limit: number;
  trial_generation_limit: number;
  created_at: Date;
  parent_status?: string;
}
export async function familyForUser(userId: string, db?: Db, lock = false) {
  // The membership lookup is a current read when reserving a credit. A plain
  // subquery here would establish a stale repeatable-read snapshot before waiting.
  const [child] = await rows<{ family_id: string }>(
    `SELECT family_id FROM family_children WHERE user_id=? ${lock ? 'FOR UPDATE' : ''}`,
    [userId],
    db,
  );
  const [family] = await rows<FamilyRow>(
    `SELECT f.*,u.status parent_status FROM families f JOIN users u ON u.id=f.parent_id WHERE ${child ? 'f.id' : 'f.parent_id'}=? ${lock ? 'FOR UPDATE' : ''}`,
    [child?.family_id || userId],
    db,
  );
  return family || null;
}
const familySummary = (f: FamilyRow): FamilySummary => ({
  id: f.id,
  parentId: f.parent_id,
  name: f.name,
  code: f.code,
  status: f.status,
  trialStartedAt: iso(f.trial_started_at),
  trialEndsAt: iso(f.trial_ends_at),
  createdAt: iso(f.created_at)!,
});
const subscriptionSelect = `SELECT s.*,f.name family_name,u.name parent_name,u.email parent_email FROM family_subscriptions s JOIN families f ON f.id=s.family_id JOIN users u ON u.id=f.parent_id`;
interface SubRow {
  id: string;
  family_id: string;
  family_name: string;
  parent_name: string;
  parent_email: string;
  plan_id: string;
  plan_name: string;
  status: FamilySubscription['status'];
  price_monthly_cents: number;
  child_limit: number;
  generation_limit: number;
  currency: 'MYR';
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
}
const subscription = (s: SubRow): FamilySubscription => ({
  id: s.id,
  familyId: s.family_id,
  familyName: s.family_name,
  parentName: s.parent_name,
  parentEmail: s.parent_email,
  planId: s.plan_id,
  planName: s.plan_name,
  status:
    s.status === 'ACTIVE' && (!s.ends_at || s.ends_at.getTime() <= Date.now())
      ? 'EXPIRED'
      : s.status,
  priceMonthlyCents: s.price_monthly_cents,
  childLimit: s.child_limit,
  generationLimit: s.generation_limit,
  currency: s.currency,
  startsAt: iso(s.starts_at),
  endsAt: iso(s.ends_at),
  createdAt: iso(s.created_at)!,
});
const localDate = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export async function learningAccess(user: User, db?: Db): Promise<LearningAccess> {
  const f = await familyForUser(user.id, db);
  if (!f)
    return {
      familyId: null,
      familyName: null,
      status: user.accountType === 'CHILD' ? 'SUSPENDED' : 'NONE',
      canLearn: user.accountType !== 'CHILD',
      canGenerate: user.accountType !== 'CHILD',
      reason: user.accountType === 'CHILD' ? 'Your family account is unavailable.' : null,
      childLimit: 0,
      generationLimit: 0,
      generationUsed: 0,
      periodEndsAt: null,
      allowedSubjects: subjects,
      allowedSchoolLevels: null,
      dailyMinutesLimit: null,
      learningSecondsToday: 0,
    };
  const [paid] = await rows<SubRow>(
    `${subscriptionSelect} WHERE s.family_id=? AND s.status='ACTIVE' AND s.starts_at<=UTC_TIMESTAMP(3) AND s.ends_at>UTC_TIMESTAMP(3) ORDER BY s.starts_at DESC LIMIT 1`,
    [f.id],
    db,
  );
  const trial = !!f.trial_ends_at && f.trial_ends_at.getTime() > Date.now();
  const [child] = await rows<{
    can_generate: number;
    allowed_subjects: Subject[] | string;
    allowed_school_levels: SchoolGrade[] | string | null;
    daily_minutes_limit: number;
  }>('SELECT * FROM family_children WHERE user_id=?', [user.id], db);
  const [usage] = child
    ? await rows<{ learning_seconds: number }>(
        'SELECT learning_seconds FROM child_daily_usage WHERE child_id=? AND local_date=?',
        [user.id, localDate(user.timezone)],
        db,
      )
    : [];
  const start = paid?.starts_at || f.trial_started_at;
  const end = paid?.ends_at || f.trial_ends_at;
  const [{ count }] = await rows<{ count: number }>(
    'SELECT COUNT(*) count FROM generation_jobs WHERE family_id=? AND created_at>=? AND created_at<?',
    [f.id, start || new Date(0), end || new Date(0)],
    db,
  );
  const blocked = f.status !== 'ACTIVE' || f.parent_status !== 'ACTIVE' || user.status !== 'ACTIVE';
  const used = usage?.learning_seconds || 0;
  const timeBlocked = !!child && used >= child.daily_minutes_limit * 60;
  const entitled = !!paid || trial;
  const limit = paid?.generation_limit ?? f.trial_generation_limit;
  return {
    familyId: f.id,
    familyName: f.name,
    status: blocked ? 'SUSPENDED' : paid ? 'ACTIVE' : trial ? 'TRIALING' : 'EXPIRED',
    canLearn: !blocked && entitled && !timeBlocked,
    canGenerate:
      !blocked && entitled && !timeBlocked && user.accountType !== 'CHILD' && count < limit,
    reason: blocked
      ? 'Your family or child account is paused.'
      : !entitled
        ? 'Your family learning period has ended.'
        : timeBlocked
          ? 'Today’s learning allowance is complete.'
          : null,
    childLimit: paid?.child_limit ?? f.trial_child_limit,
    generationLimit: limit,
    generationUsed: count,
    periodEndsAt: iso(end),
    allowedSubjects: child ? json(child.allowed_subjects) : subjects,
    allowedSchoolLevels: child?.allowed_school_levels ? json(child.allowed_school_levels) : null,
    dailyMinutesLimit: child?.daily_minutes_limit ?? null,
    learningSecondsToday: used,
  };
}
export async function assertLearning(user: User, subject?: string, generation = false, db?: Db) {
  const access = await learningAccess(user, db);
  if (!access.canLearn)
    throw new ApiError(403, 'LEARNING_UNAVAILABLE', access.reason || 'Learning is unavailable.');
  if (subject && !access.allowedSubjects.includes(subject as Subject))
    throw new ApiError(403, 'SUBJECT_RESTRICTED', 'Ask your parent to allow this subject.');
  if (generation && user.accountType === 'CHILD') {
    const [child] = await rows<{ can_generate: number }>(
      'SELECT can_generate FROM family_children WHERE user_id=?',
      [user.id],
      db,
    );
    if (!child?.can_generate)
      throw new ApiError(
        403,
        'GENERATION_RESTRICTED',
        'Ask your parent to allow lesson generation.',
      );
  }
  if (generation && !access.canGenerate)
    throw new ApiError(
      access.generationUsed >= access.generationLimit && access.familyId ? 429 : 403,
      access.generationUsed >= access.generationLimit && access.familyId
        ? 'FAMILY_GENERATION_LIMIT'
        : 'GENERATION_RESTRICTED',
      'Your family generation allowance or generation permission is unavailable.',
    );
  return access;
}
export async function reserveFamilyGeneration(user: User, subject: string, db: Db) {
  const f = await familyForUser(user.id, db, true);
  await assertLearning(user, subject, true, db);
  return f?.id || null;
}
export async function heartbeat(user: User, payload: unknown): Promise<LearningAccess> {
  z.strictObject({}).parse(payload || {});
  await transaction(async (db) => {
    const child = await rows(
      'SELECT user_id FROM family_children WHERE user_id=? FOR UPDATE',
      [user.id],
      db,
    );
    await assertLearning(user, undefined, false, db);
    if (!child.length) return;
    const day = localDate(user.timezone);
    await run(
      'INSERT IGNORE INTO child_daily_usage(child_id,local_date) VALUES(?,?)',
      [user.id, day],
      db,
    );
    const [usage] = await rows<{ heartbeat_at: Date | null; learning_seconds: number }>(
      'SELECT * FROM child_daily_usage WHERE child_id=? AND local_date=? FOR UPDATE',
      [user.id, day],
      db,
    );
    const now = Date.now();
    const elapsed = usage.heartbeat_at ? Math.max(0, now - usage.heartbeat_at.getTime()) : 0;
    const seconds = Math.min(30, Math.floor(elapsed / 1000));
    // Preserve fractional seconds so frequent tabs/requests cannot erase elapsed time.
    const nextHeartbeat =
      usage.heartbeat_at && elapsed <= 30000
        ? new Date(usage.heartbeat_at.getTime() + seconds * 1000)
        : new Date(now);
    const access = await learningAccess(user, db);
    await run(
      'UPDATE child_daily_usage SET learning_seconds=LEAST(learning_seconds+?,?),heartbeat_at=? WHERE child_id=? AND local_date=?',
      [seconds, (access.dailyMinutesLimit || 240) * 60, nextHeartbeat, user.id, day],
      db,
    );
  });
  return learningAccess(user);
}
export async function plans(activeOnly = true, db?: Db): Promise<SubscriptionPlan[]> {
  const result = await rows<{
    id: string;
    name: string;
    description: string;
    priceMonthlyCents: number;
    currency: 'MYR';
    childLimit: number;
    generationLimit: number;
    trialDays: number;
    isActive: number;
    createdAt: Date;
  }>(
    `SELECT id,name,description,price_monthly_cents priceMonthlyCents,currency,child_limit childLimit,generation_limit generationLimit,trial_days trialDays,is_active isActive,created_at createdAt FROM subscription_plans ${activeOnly ? 'WHERE is_active=1' : ''} ORDER BY price_monthly_cents,created_at`,
    [],
    db,
  );
  return result.map((p) => ({ ...p, isActive: !!p.isActive, createdAt: iso(p.createdAt)! }));
}
export async function registerParent(payload: unknown) {
  const input = z
    .strictObject({
      name: z.string().trim().min(2).max(100),
      email: z
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(10).max(128),
      familyName: z.string().trim().min(2).max(100),
    })
    .parse(payload);
  if (input.email.endsWith('@child.wonderlab.invalid'))
    throw new ApiError(400, 'RESERVED_EMAIL', 'Use your own email address.');
  const id = randomUUID(),
    familyId = randomUUID(),
    passwordHash = await bcrypt.hash(input.password, 12);
  await transaction(async (db) => {
    const plan = (await plans(true, db))[0];
    if (!plan)
      throw new ApiError(
        409,
        'NO_ACTIVE_PLAN',
        'Registration is unavailable until an administrator activates a plan.',
      );
    await run(
      'INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',
      [id, input.name, input.email, passwordHash],
      db,
    );
    await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'PARENT')", [id], db);
    await run(
      'INSERT INTO families(id,parent_id,name,code,trial_started_at,trial_ends_at,trial_child_limit,trial_generation_limit) VALUES(?,?,?,?,?,?,?,?)',
      [
        familyId,
        id,
        input.familyName,
        randomBytes(6).toString('hex').toUpperCase(),
        new Date(),
        new Date(Date.now() + plan.trialDays * 86400000),
        plan.childLimit,
        plan.generationLimit,
      ],
      db,
    );
  });
  return (await getUser(id))!;
}
async function requireParent(user: User, db?: Db, lock = false) {
  const f = await familyForUser(user.id, db, lock);
  if (!f || f.parent_id !== user.id)
    throw new ApiError(403, 'PARENT_REQUIRED', 'Sign in as a parent to manage your family.');
  return f;
}
async function ownChild(user: User, id: string, db?: Db) {
  const f = await requireParent(user, db);
  const [child] = await rows(
    'SELECT user_id FROM family_children WHERE user_id=? AND family_id=?',
    [id, f.id],
    db,
  );
  if (!child) throw new ApiError(404, 'CHILD_NOT_FOUND', 'This child is unavailable.');
  return f;
}
async function childProfile(id: string): Promise<FamilyChild> {
  const [c] = await rows<{
    id: string;
    name: string;
    username: string;
    schoolLevel: string;
    avatar: FamilyChild['avatar'];
    status: FamilyChild['status'];
    canGenerate: number;
    allowedSubjects: Subject[] | string;
    allowedSchoolLevels: SchoolGrade[] | string | null;
    dailyMinutesLimit: number;
    createdAt: Date;
  }>(
    'SELECT u.id,u.name,c.username,c.school_level schoolLevel,c.avatar,u.status,c.can_generate canGenerate,c.allowed_subjects allowedSubjects,c.allowed_school_levels allowedSchoolLevels,c.daily_minutes_limit dailyMinutesLimit,u.created_at createdAt FROM family_children c JOIN users u ON u.id=c.user_id WHERE c.user_id=?',
    [id],
  );
  const user = (await getUser(id))!;
  return {
    ...c,
    canGenerate: !!c.canGenerate,
    allowedSubjects: json(c.allowedSubjects),
    allowedSchoolLevels: c.allowedSchoolLevels ? json(c.allowedSchoolLevels) : null,
    learningSecondsToday: (await learningAccess(user)).learningSecondsToday,
    stats: await getStats(user),
    createdAt: iso(c.createdAt)!,
  };
}
export async function createChild(user: User, payload: unknown): Promise<FamilyChild> {
  const input = childCreateSchema.parse(payload),
    id = randomUUID(),
    passwordHash = await bcrypt.hash(input.passcode, 12);
  await transaction(async (db) => {
    const f = await requireParent(user, db, true),
      access = await learningAccess(user, db);
    if (!access.canLearn) throw new ApiError(403, 'LEARNING_UNAVAILABLE', access.reason!);
    const [{ count }] = await rows<{ count: number }>(
      'SELECT COUNT(*) count FROM family_children WHERE family_id=?',
      [f.id],
      db,
    );
    if (count >= access.childLimit)
      throw new ApiError(409, 'CHILD_LIMIT', 'Your family has reached its child profile limit.');
    await run(
      'INSERT INTO users(id,name,email,password_hash,timezone) VALUES(?,?,?,?,?)',
      [id, input.name, `${id}@child.wonderlab.invalid`, passwordHash, user.timezone],
      db,
    );
    await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'STUDENT')", [id], db);
    await run(
      'INSERT INTO family_children(user_id,family_id,username,school_level,avatar,can_generate,allowed_subjects,allowed_school_levels,daily_minutes_limit) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        id,
        f.id,
        input.username,
        input.schoolLevel,
        input.avatar,
        input.canGenerate,
        JSON.stringify(input.allowedSubjects),
        input.allowedSchoolLevels === null ? null : JSON.stringify(input.allowedSchoolLevels),
        input.dailyMinutesLimit,
      ],
      db,
    );
  });
  return childProfile(id);
}
export async function updateChild(user: User, id: string, payload: unknown) {
  const parsed = childUpdateSchema.parse(payload);
  const input = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => Object.prototype.hasOwnProperty.call(payload, key)),
  ) as typeof parsed;
  await transaction(async (db) => {
    await ownChild(user, id, db);
    if (input.name !== undefined)
      await run('UPDATE users SET name=? WHERE id=?', [input.name, id], db);
    if (input.status !== undefined)
      await run('UPDATE users SET status=? WHERE id=?', [input.status, id], db);
    const columns: { [key: string]: string } = {
      schoolLevel: 'school_level',
      avatar: 'avatar',
      canGenerate: 'can_generate',
      allowedSubjects: 'allowed_subjects',
      allowedSchoolLevels: 'allowed_school_levels',
      dailyMinutesLimit: 'daily_minutes_limit',
    };
    for (const [key, column] of Object.entries(columns)) {
      const value = input[key as keyof typeof input];
      if (value !== undefined)
        await run(
          `UPDATE family_children SET ${column}=? WHERE user_id=?`,
          [
            (key === 'allowedSubjects' || key === 'allowedSchoolLevels') && value !== null
              ? JSON.stringify(value)
              : value,
            id,
          ],
          db,
        );
    }
  });
  return childProfile(id);
}
export async function resetPasscode(user: User, id: string, payload: unknown) {
  const { passcode } = z.strictObject({ passcode: z.string().min(6).max(72) }).parse(payload);
  const hash = await bcrypt.hash(passcode, 12);
  await transaction(async (db) => {
    await ownChild(user, id, db);
    await run('UPDATE users SET password_hash=? WHERE id=?', [hash, id], db);
    await run(
      'UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE user_id=? AND revoked_at IS NULL',
      [id],
      db,
    );
  });
  return { ok: true };
}
export async function childProgress(user: User, id: string) {
  await ownChild(user, id);
  return getStats((await getUser(id))!);
}
export async function familyDashboard(familyId: string): Promise<FamilyDashboard> {
  const [f] = await rows<FamilyRow>('SELECT * FROM families WHERE id=?', [familyId]);
  if (!f) throw new ApiError(404, 'FAMILY_NOT_FOUND', 'This family is unavailable.');
  const children = await rows<{ user_id: string }>(
    'SELECT user_id FROM family_children WHERE family_id=? ORDER BY username',
    [f.id],
  );
  const history = (
    await rows<SubRow>(`${subscriptionSelect} WHERE s.family_id=? ORDER BY s.created_at DESC`, [
      f.id,
    ])
  ).map(subscription);
  return {
    family: familySummary(f),
    access: await learningAccess((await getUser(f.parent_id))!),
    children: await Promise.all(children.map((c) => childProfile(c.user_id))),
    subscription: history.find((s) => s.status === 'ACTIVE') || null,
    pendingSubscription: history.find((s) => s.status === 'PENDING') || null,
  };
}
export async function parentDashboard(user: User) {
  return familyDashboard((await requireParent(user)).id);
}
export async function billing(user: User): Promise<FamilyBilling> {
  const f = await requireParent(user);
  return {
    ...(await familyDashboard(f.id)),
    plans: await plans(),
    history: (
      await rows<SubRow>(`${subscriptionSelect} WHERE s.family_id=? ORDER BY s.created_at DESC`, [
        f.id,
      ])
    ).map(subscription),
  };
}
export async function createSubscription(familyId: string, planId: string, periodDays?: number) {
  const id = randomUUID();
  await transaction(async (db) => {
    const [f] = await rows('SELECT id FROM families WHERE id=? FOR UPDATE', [familyId], db);
    if (!f) throw new ApiError(404, 'FAMILY_NOT_FOUND', 'This family is unavailable.');
    const plan = (await plans(true, db)).find((p) => p.id === planId);
    if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'This plan is unavailable.');
    if (periodDays) {
      await run(
        "UPDATE family_subscriptions SET status='CANCELLED' WHERE family_id=? AND status IN ('ACTIVE','PENDING')",
        [familyId],
        db,
      );
    } else {
      const pending = await rows(
        "SELECT id FROM family_subscriptions WHERE family_id=? AND status='PENDING'",
        [familyId],
        db,
      );
      if (pending.length)
        throw new ApiError(
          409,
          'SUBSCRIPTION_PENDING',
          'Cancel your existing request before requesting another plan.',
        );
    }
    await run(
      'INSERT INTO family_subscriptions(id,family_id,plan_id,plan_name,price_monthly_cents,child_limit,generation_limit,status,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [
        id,
        familyId,
        planId,
        plan.name,
        plan.priceMonthlyCents,
        plan.childLimit,
        plan.generationLimit,
        periodDays ? 'ACTIVE' : 'PENDING',
        periodDays ? new Date() : null,
        periodDays ? new Date(Date.now() + periodDays * 86400000) : null,
      ],
      db,
    );
  });
  return subscription((await rows<SubRow>(`${subscriptionSelect} WHERE s.id=?`, [id]))[0]);
}
export async function requestSubscription(user: User, payload: unknown) {
  const { planId } = z.strictObject({ planId: z.uuid() }).parse(payload);
  return createSubscription((await requireParent(user)).id, planId);
}
export async function cancelSubscription(id: string, user?: User) {
  await transaction(async (db) => {
    const f = user ? await requireParent(user, db, true) : null;
    const [s] = await rows<SubRow>(
      `SELECT * FROM family_subscriptions WHERE id=? ${f ? 'AND family_id=?' : ''} FOR UPDATE`,
      [id, ...(f ? [f.id] : [])],
      db,
    );
    if (!s) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'This subscription is unavailable.');
    await run("UPDATE family_subscriptions SET status='CANCELLED' WHERE id=?", [id], db);
  });
  return subscription((await rows<SubRow>(`${subscriptionSelect} WHERE s.id=?`, [id]))[0]);
}
export async function savePlan(payload: unknown, id?: string) {
  const input = (
    id ? planInputSchema.partial().refine((v) => Object.keys(v).length > 0) : planInputSchema
  ).parse(payload);
  const columns: { [key: string]: string } = {
    name: 'name',
    description: 'description',
    priceMonthlyCents: 'price_monthly_cents',
    childLimit: 'child_limit',
    generationLimit: 'generation_limit',
    trialDays: 'trial_days',
    isActive: 'is_active',
  };
  if (id) {
    if (!(await plans(false)).some((p) => p.id === id))
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'This plan is unavailable.');
    await run(
      `UPDATE subscription_plans SET ${Object.keys(input)
        .map((key) => columns[key] + '=?')
        .join(',')} WHERE id=?`,
      [...Object.values(input), id],
    );
  } else {
    id = randomUUID();
    await run(
      `INSERT INTO subscription_plans(id,${Object.keys(input)
        .map((k) => columns[k])
        .join(',')}) VALUES(${Array(Object.keys(input).length + 1)
        .fill('?')
        .join(',')})`,
      [id, ...Object.values(input)],
    );
  }
  return (await plans(false)).find((p) => p.id === id)!;
}
export async function listPlans(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pagination(query);
  const data = await plans(false);
  return paginated(data.slice(offset, offset + pageSize), data.length, page, pageSize);
}
export async function listFamilies(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pagination(query);
  const search = String(query.search || '').slice(0, 180);
  const where = search ? 'WHERE f.name LIKE ? OR u.name LIKE ? OR u.email LIKE ?' : '';
  const params = search ? Array(3).fill('%' + search + '%') : [];
  const data = await rows<
    FamilyRow & { parentName: string; parentEmail: string; childCount: number }
  >(
    `SELECT f.*,u.name parentName,u.email parentEmail,(SELECT COUNT(*) FROM family_children WHERE family_id=f.id) childCount FROM families f JOIN users u ON u.id=f.parent_id ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const [{ total }] = await rows<{ total: number }>(
    `SELECT COUNT(*) total FROM families f JOIN users u ON u.id=f.parent_id ${where}`,
    params,
  );
  return paginated(
    await Promise.all(
      data.map(
        async (f) =>
          ({
            ...familySummary(f),
            parentName: f.parentName,
            parentEmail: f.parentEmail,
            childCount: f.childCount,
            access: await learningAccess((await getUser(f.parent_id))!),
          }) satisfies AdminFamily,
      ),
    ),
    total,
    page,
    pageSize,
  );
}
export async function updateFamily(id: string, payload: unknown) {
  const input = z
    .strictObject({
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      trialDays: z.number().int().min(0).max(365).optional(),
    })
    .refine((v) => Object.keys(v).length > 0)
    .parse(payload);
  await transaction(async (db) => {
    const [f] = await rows('SELECT id FROM families WHERE id=? FOR UPDATE', [id], db);
    if (!f) throw new ApiError(404, 'FAMILY_NOT_FOUND', 'This family is unavailable.');
    if (input.status) await run('UPDATE families SET status=? WHERE id=?', [input.status, id], db);
    if (input.trialDays !== undefined)
      await run(
        'UPDATE families SET trial_started_at=?,trial_ends_at=? WHERE id=?',
        [new Date(), new Date(Date.now() + input.trialDays * 86400000), id],
        db,
      );
  });
  return familyDashboard(id);
}
export async function listSubscriptions(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pagination(query);
  const status = query.status
    ? z.enum(['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED']).parse(query.status)
    : null;
  const effectiveStatus =
    "CASE WHEN s.status='ACTIVE' AND (s.ends_at IS NULL OR s.ends_at<=UTC_TIMESTAMP(3)) THEN 'EXPIRED' ELSE s.status END";
  const where = status ? `WHERE (${effectiveStatus})=?` : '';
  const values = status ? [status] : [];
  const [{ total }] = await rows<{ total: number }>(
    `SELECT COUNT(*) total FROM family_subscriptions s ${where}`,
    values,
  );
  return paginated(
    (
      await rows<SubRow>(
        `${subscriptionSelect} ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
      )
    ).map(subscription),
    total,
    page,
    pageSize,
  );
}
