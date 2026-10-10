import { randomUUID } from 'node:crypto';
import {
  z,
  rewardInputSchema,
  rewardRulesSchema,
  defaultRewardRules,
  redeemRewardSchema,
  rewardDecisionSchema,
  type User,
  type FamilyReward,
  type RewardRedemption,
  type RewardRules,
  type StarWallet,
  type StarTransaction,
  type ParentRewardsDashboard,
} from '@wonderlab/shared';
import { rows, run, transaction, type Db } from '../db/pool.js';
import { ApiError, pagination, paginated } from '../http.js';

interface ChildFamily {
  family_id: string;
  child_status: string;
  family_status: string;
  parent_status: string;
}
async function childFamily(user: User, db?: Db, active = false) {
  const [family] = await rows<ChildFamily>(
    'SELECT c.family_id,u.status child_status,f.status family_status,p.status parent_status FROM family_children c JOIN users u ON u.id=c.user_id JOIN families f ON f.id=c.family_id JOIN users p ON p.id=f.parent_id WHERE c.user_id=?' +
      (active ? ' FOR SHARE' : ''),
    [user.id],
    db,
  );
  if (!family || user.accountType !== 'CHILD')
    throw new ApiError(
      403,
      'CHILD_REQUIRED',
      'Sign in with a child account to use family rewards.',
    );
  if (
    active &&
    [family.child_status, family.family_status, family.parent_status].some(
      (status) => status !== 'ACTIVE',
    )
  )
    throw new ApiError(
      403,
      'REWARDS_PAUSED',
      'Your family or child account is paused. Ask your parent before redeeming.',
    );
  return family;
}
async function parentFamily(user: User, db?: Db) {
  const [family] = await rows<{ id: string }>(
    'SELECT id FROM families WHERE parent_id=?',
    [user.id],
    db,
  );
  if (!family)
    throw new ApiError(403, 'PARENT_REQUIRED', 'Sign in as a parent to manage your family.');
  return family.id;
}
async function ownChild(familyId: string, id: string, db?: Db) {
  if (
    !(
      await rows(
        'SELECT user_id FROM family_children WHERE family_id=? AND user_id=?',
        [familyId, id],
        db,
      )
    ).length
  )
    throw new ApiError(404, 'CHILD_NOT_FOUND', 'This child is unavailable.');
}
async function rules(familyId: string, db?: Db): Promise<RewardRules> {
  const [rule] = await rows<RewardRules>(
    'SELECT lesson_stars lessonStars,correct_answer_stars correctAnswerStars,perfect_quiz_bonus_stars perfectQuizBonusStars FROM family_reward_settings WHERE family_id=?',
    [familyId],
    db,
  );
  return rule || { ...defaultRewardRules };
}
const rewardSelect =
  'SELECT r.*,u.name child_name FROM family_rewards r LEFT JOIN users u ON u.id=r.child_id';
interface RewardRow {
  id: string;
  family_id: string;
  child_id: string | null;
  child_name: string | null;
  name: string;
  description: string;
  emoji: FamilyReward['emoji'];
  image_key: FamilyReward['imageKey'];
  star_cost: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}
const reward = (r: RewardRow): FamilyReward => ({
  id: r.id,
  familyId: r.family_id,
  childId: r.child_id,
  childName: r.child_name,
  name: r.name,
  description: r.description,
  emoji: r.emoji,
  imageKey: r.image_key,
  starCost: r.star_cost,
  isActive: !!r.is_active,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});
const redemptionSelect =
  'SELECT r.*,u.name child_name FROM reward_redemptions r JOIN users u ON u.id=r.child_id';
interface RedemptionRow {
  id: string;
  family_id: string;
  reward_id: string;
  request_id: string;
  child_id: string;
  child_name: string;
  name: string;
  description: string;
  emoji: string;
  image_key: FamilyReward['imageKey'];
  star_cost: number;
  status: RewardRedemption['status'];
  note: string;
  created_at: Date;
  resolved_at: Date | null;
}
const redemption = (r: RedemptionRow): RewardRedemption => ({
  id: r.id,
  rewardId: r.reward_id,
  childId: r.child_id,
  childName: r.child_name,
  name: r.name,
  description: r.description,
  emoji: r.emoji,
  imageKey: r.image_key,
  starCost: r.star_cost,
  status: r.status,
  note: r.note,
  createdAt: r.created_at.toISOString(),
  resolvedAt: r.resolved_at?.toISOString() || null,
});

export async function getParentRewards(user: User): Promise<ParentRewardsDashboard> {
  const familyId = await parentFamily(user);
  return {
    rules: await rules(familyId),
    children: await rows(
      'SELECT c.user_id id,u.name,c.avatar,COALESCE(w.balance,0) balance,COALESCE(w.lifetime_earned,0) lifetimeEarned FROM family_children c JOIN users u ON u.id=c.user_id LEFT JOIN child_star_wallets w ON w.child_id=c.user_id WHERE c.family_id=? ORDER BY u.name',
      [familyId],
    ),
  };
}
export async function saveRewardRules(user: User, payload: unknown) {
  const input = rewardRulesSchema.parse(payload),
    familyId = await parentFamily(user);
  await run(
    'INSERT INTO family_reward_settings(family_id,lesson_stars,correct_answer_stars,perfect_quiz_bonus_stars) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE lesson_stars=VALUES(lesson_stars),correct_answer_stars=VALUES(correct_answer_stars),perfect_quiz_bonus_stars=VALUES(perfect_quiz_bonus_stars)',
    [familyId, input.lessonStars, input.correctAnswerStars, input.perfectQuizBonusStars],
  );
  return input;
}
export async function saveReward(user: User, payload: unknown, id?: string) {
  const input = rewardInputSchema.parse(payload);
  return transaction(async (db) => {
    const familyId = await parentFamily(user, db);
    if (input.childId) await ownChild(familyId, input.childId, db);
    const rewardId = id ? z.uuid().parse(id) : randomUUID();
    if (id) {
      const [existing] = await rows(
        'SELECT id FROM family_rewards WHERE id=? AND family_id=? FOR UPDATE',
        [rewardId, familyId],
        db,
      );
      if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'This prize is unavailable.');
      await run(
        'UPDATE family_rewards SET name=?,description=?,emoji=?,image_key=?,star_cost=?,child_id=?,is_active=? WHERE id=?',
        [
          input.name,
          input.description,
          input.emoji,
          input.imageKey,
          input.starCost,
          input.childId,
          input.isActive,
          rewardId,
        ],
        db,
      );
    } else
      await run(
        'INSERT INTO family_rewards(id,family_id,name,description,emoji,image_key,star_cost,child_id,is_active) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          rewardId,
          familyId,
          input.name,
          input.description,
          input.emoji,
          input.imageKey,
          input.starCost,
          input.childId,
          input.isActive,
        ],
        db,
      );
    const [result] = await rows<RewardRow>(rewardSelect + ' WHERE r.id=?', [rewardId], db);
    return reward(result);
  });
}
export async function listRewards(user: User, query: unknown, parent = false) {
  const { page, pageSize, offset } = pagination(query);
  const { childId } = z.object({ childId: z.uuid().optional() }).parse(query);
  const familyId = parent ? await parentFamily(user) : (await childFamily(user)).family_id;
  if (parent && childId) await ownChild(familyId, childId);
  const where = `r.family_id=?${parent ? (childId ? ' AND (r.child_id IS NULL OR r.child_id=?)' : '') : ' AND r.is_active=1 AND (r.child_id IS NULL OR r.child_id=?)'}`;
  const values = parent ? (childId ? [familyId, childId] : [familyId]) : [familyId, user.id];
  const [{ total }] = await rows<{ total: number }>(
    'SELECT COUNT(*) total FROM family_rewards r WHERE ' + where,
    values,
  );
  const data = await rows<RewardRow>(
    rewardSelect + ' WHERE ' + where + ' ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?',
    [...values, pageSize, offset],
  );
  return paginated(data.map(reward), Number(total), page, pageSize);
}
export async function getStarWallet(user: User): Promise<StarWallet> {
  const family = await childFamily(user);
  const [wallet] = await rows<{ balance: number; lifetimeEarned: number }>(
    'SELECT balance,lifetime_earned lifetimeEarned FROM child_star_wallets WHERE child_id=?',
    [user.id],
  );
  const [{ pending }] = await rows<{ pending: number }>(
    "SELECT COALESCE(SUM(star_cost),0) pending FROM reward_redemptions WHERE child_id=? AND status='PENDING'",
    [user.id],
  );
  return {
    balance: wallet?.balance || 0,
    lifetimeEarned: wallet?.lifetimeEarned || 0,
    pendingStars: Number(pending),
    rules: await rules(family.family_id),
  };
}
export async function listStarTransactions(user: User, query: unknown) {
  await childFamily(user);
  const { page, pageSize, offset } = pagination(query);
  const [{ total }] = await rows<{ total: number }>(
    'SELECT COUNT(*) total FROM child_star_transactions WHERE child_id=?',
    [user.id],
  );
  const data = await rows<StarTransaction & { createdAt: Date }>(
    'SELECT id,amount,kind,reason,created_at createdAt FROM child_star_transactions WHERE child_id=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?',
    [user.id, pageSize, offset],
  );
  return paginated(
    data.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    Number(total),
    page,
    pageSize,
  );
}
export async function listRedemptions(user: User, query: unknown, parent = false) {
  const { page, pageSize, offset } = pagination(query);
  const filter = z
    .object({
      status: z.enum(['PENDING', 'FULFILLED', 'DECLINED', 'CANCELLED']).optional(),
      childId: z.uuid().optional(),
    })
    .parse(query);
  const familyId = parent ? await parentFamily(user) : (await childFamily(user)).family_id;
  if (parent && filter.childId) await ownChild(familyId, filter.childId);
  const childId = parent ? filter.childId : user.id;
  const where = `r.family_id=?${childId ? ' AND r.child_id=?' : ''}${filter.status ? ' AND r.status=?' : ''}`;
  const values = [
    familyId,
    ...(childId ? [childId] : []),
    ...(filter.status ? [filter.status] : []),
  ];
  const [{ total }] = await rows<{ total: number }>(
    'SELECT COUNT(*) total FROM reward_redemptions r WHERE ' + where,
    values,
  );
  const data = await rows<RedemptionRow>(
    redemptionSelect + ' WHERE ' + where + ' ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?',
    [...values, pageSize, offset],
  );
  return paginated(data.map(redemption), Number(total), page, pageSize);
}
async function lockWallet(id: string, db: Db) {
  await run('INSERT IGNORE INTO child_star_wallets(child_id) VALUES(?)', [id], db);
  const [wallet] = await rows<{ balance: number }>(
    'SELECT balance FROM child_star_wallets WHERE child_id=? FOR UPDATE',
    [id],
    db,
  );
  return wallet;
}
async function starDelta(
  childId: string,
  amount: number,
  source: string,
  kind: StarTransaction['kind'],
  reason: string,
  db: Db,
  lessonId: string | null = null,
  redemptionId: string | null = null,
) {
  const wallet = await lockWallet(childId, db);
  const previous = await rows(
    'SELECT id FROM child_star_transactions WHERE child_id=? AND source_key=? FOR UPDATE',
    [childId, source],
    db,
  );
  if (previous.length || !amount) return 0;
  if (wallet.balance + amount < 0)
    throw new ApiError(
      409,
      'NOT_ENOUGH_STARS',
      'You need more Stars for this prize. Keep learning!',
    );
  await run(
    'INSERT INTO child_star_transactions(id,child_id,lesson_id,redemption_id,source_key,amount,kind,reason) VALUES(?,?,?,?,?,?,?,?)',
    [randomUUID(), childId, lessonId, redemptionId, source, amount, kind, reason],
    db,
  );
  await run(
    'UPDATE child_star_wallets SET balance=balance+?,lifetime_earned=lifetime_earned+? WHERE child_id=?',
    [amount, kind === 'EARN' ? amount : 0, childId],
    db,
  );
  return amount;
}
export type LearningStarEvent =
  { kind: 'LESSON' } | { kind: 'QUIZ'; correctAnswers: number; perfect: boolean };
export async function awardLearningStars(
  userId: string,
  lessonId: string,
  xpKey: string,
  event: LearningStarEvent,
  db: Db,
) {
  const [child] = await rows<{ family_id: string }>(
    'SELECT family_id FROM family_children WHERE user_id=?',
    [userId],
    db,
  );
  if (!child) return 0;
  const setting = await rules(child.family_id, db);
  const amount =
    event.kind === 'LESSON'
      ? setting.lessonStars
      : event.correctAnswers * setting.correctAnswerStars +
        (event.perfect ? setting.perfectQuizBonusStars : 0);
  if (!amount) return 0;
  return starDelta(
    userId,
    amount,
    'earn:' + xpKey,
    'EARN',
    event.kind === 'LESSON' ? 'Lesson completed' : 'Quiz answered',
    db,
    lessonId,
  );
}
export async function redeemReward(user: User, id: string, payload: unknown) {
  const input = redeemRewardSchema.parse(payload),
    rewardId = z.uuid().parse(id);
  return transaction(async (db) => {
    await childFamily(user, db);
    const wallet = await lockWallet(user.id, db);
    // Check current account/membership state after waiting for the wallet, and
    // hold shared status locks until commit so a concurrent pause is respected.
    const family = await childFamily(user, db, true);
    const [prior] = await rows<RedemptionRow>(
      redemptionSelect + ' WHERE r.child_id=? AND r.request_id=? FOR UPDATE',
      [user.id, input.requestId],
      db,
    );
    if (prior) {
      if (prior.reward_id !== rewardId)
        throw new ApiError(
          409,
          'REQUEST_REUSED',
          'This request already belongs to a different prize.',
        );
      return redemption(prior);
    }
    const [item] = await rows<RewardRow>(
      rewardSelect +
        ' WHERE r.id=? AND r.family_id=? AND (r.child_id IS NULL OR r.child_id=?) FOR UPDATE',
      [rewardId, family.family_id, user.id],
      db,
    );
    if (!item) throw new ApiError(404, 'REWARD_NOT_FOUND', 'This prize is unavailable.');
    if (!item.is_active)
      throw new ApiError(409, 'REWARD_PAUSED', 'This prize is paused. Choose another prize.');
    if (
      (
        await rows(
          "SELECT id FROM reward_redemptions WHERE child_id=? AND reward_id=? AND status='PENDING' FOR UPDATE",
          [user.id, rewardId],
          db,
        )
      ).length
    )
      throw new ApiError(
        409,
        'REWARD_PENDING',
        'You already have a request for this prize. Ask your parent to check it.',
      );
    if (wallet.balance < item.star_cost)
      throw new ApiError(
        409,
        'NOT_ENOUGH_STARS',
        'You need more Stars for this prize. Keep learning!',
      );
    const requestId = randomUUID();
    await run(
      'INSERT INTO reward_redemptions(id,family_id,child_id,reward_id,request_id,name,description,emoji,image_key,star_cost) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [
        requestId,
        family.family_id,
        user.id,
        rewardId,
        input.requestId,
        item.name,
        item.description,
        item.emoji,
        item.image_key,
        item.star_cost,
      ],
      db,
    );
    await starDelta(
      user.id,
      -item.star_cost,
      'redeem:' + requestId,
      'REDEEM',
      'Prize requested: ' + item.name,
      db,
      null,
      requestId,
    );
    const [saved] = await rows<RedemptionRow>(redemptionSelect + ' WHERE r.id=?', [requestId], db);
    return redemption(saved);
  });
}
async function resolveRequest(
  user: User,
  id: string,
  status: Exclude<RewardRedemption['status'], 'PENDING'>,
  note: string,
  parent: boolean,
) {
  const requestId = z.uuid().parse(id);
  return transaction(async (db) => {
    const familyId = parent
      ? await parentFamily(user, db)
      : (await childFamily(user, db)).family_id;
    const where = `r.id=? AND r.family_id=?${parent ? '' : ' AND r.child_id=?'}`;
    const values = [requestId, familyId, ...(parent ? [] : [user.id])];
    const [lookup] = await rows<RedemptionRow>(redemptionSelect + ' WHERE ' + where, values, db);
    if (!lookup)
      throw new ApiError(404, 'REDEMPTION_NOT_FOUND', 'This prize request is unavailable.');
    // Every spend/refund locks the wallet first, then the request. This order is
    // shared by cancellation, parent decisions and concurrent redeem attempts.
    await lockWallet(lookup.child_id, db);
    const [current] = await rows<RedemptionRow>(
      redemptionSelect + ' WHERE ' + where + ' FOR UPDATE',
      values,
      db,
    );
    if (!current)
      throw new ApiError(404, 'REDEMPTION_NOT_FOUND', 'This prize request is unavailable.');
    if (current.status === status) return redemption(current);
    if (current.status !== 'PENDING')
      throw new ApiError(
        409,
        'REDEMPTION_RESOLVED',
        'This prize request has already been resolved.',
      );
    await run(
      'UPDATE reward_redemptions SET status=?,note=?,resolved_at=UTC_TIMESTAMP(3) WHERE id=?',
      [status, note, requestId],
      db,
    );
    if (status !== 'FULFILLED')
      await starDelta(
        current.child_id,
        current.star_cost,
        'refund:' + requestId,
        'REFUND',
        'Stars returned: ' + current.name,
        db,
        null,
        requestId,
      );
    const [saved] = await rows<RedemptionRow>(redemptionSelect + ' WHERE r.id=?', [requestId], db);
    return redemption(saved);
  });
}
export async function decideRedemption(user: User, id: string, payload: unknown) {
  const input = rewardDecisionSchema.parse(payload);
  return resolveRequest(user, id, input.status, input.note, true);
}
export async function cancelRedemption(user: User, id: string, payload: unknown) {
  z.strictObject({}).parse(payload || {});
  return resolveRequest(user, id, 'CANCELLED', '', false);
}
