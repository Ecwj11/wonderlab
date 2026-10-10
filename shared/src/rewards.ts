import { z } from 'zod';
export const rewardEmojis = ['🎁', '🍦', '📚', '🧸', '🎮', '🌳', '🎨', '🎬', '🍕', '🚲'] as const;
export const rewardImageKeys = ['storybook', 'family-meal', 'toy-set'] as const;
export const rewardImages = {
  storybook: { src: '/images/rewards/storybook.png', label: 'Storybooks' },
  'family-meal': { src: '/images/rewards/family-meal.png', label: 'Family meal' },
  'toy-set': { src: '/images/rewards/toy-set.png', label: 'Toy set' },
} as const;
export const rewardInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  emoji: z.enum(rewardEmojis),
  imageKey: z.enum(rewardImageKeys).nullable().default(null),
  starCost: z.number().int().min(1).max(1000000),
  childId: z.uuid().nullable(),
  isActive: z.boolean(),
});
export type RewardInput = z.infer<typeof rewardInputSchema>;
export const rewardRulesSchema = z.strictObject({
  lessonStars: z.number().int().min(0).max(100),
  correctAnswerStars: z.number().int().min(0).max(100),
  perfectQuizBonusStars: z.number().int().min(0).max(100),
});
export type RewardRules = z.infer<typeof rewardRulesSchema>;
export const defaultRewardRules: RewardRules = {
  lessonStars: 5,
  correctAnswerStars: 1,
  perfectQuizBonusStars: 5,
};
export const redeemRewardSchema = z.strictObject({ requestId: z.uuid() });
export const rewardDecisionSchema = z.strictObject({
  status: z.enum(['FULFILLED', 'DECLINED']),
  note: z.string().trim().max(300).default(''),
});
export interface FamilyReward extends RewardInput {
  id: string;
  familyId: string;
  childName: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface RewardRedemption {
  id: string;
  rewardId: string;
  childId: string;
  childName: string;
  name: string;
  description: string;
  emoji: string;
  imageKey: RewardInput['imageKey'];
  starCost: number;
  status: 'PENDING' | 'FULFILLED' | 'DECLINED' | 'CANCELLED';
  note: string;
  createdAt: string;
  resolvedAt: string | null;
}
export interface StarWallet {
  balance: number;
  lifetimeEarned: number;
  pendingStars: number;
  rules: RewardRules;
}
export interface StarTransaction {
  id: string;
  amount: number;
  kind: 'EARN' | 'REDEEM' | 'REFUND';
  reason: string;
  createdAt: string;
}
export interface RewardChildBalance {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  lifetimeEarned: number;
}
export interface ParentRewardsDashboard {
  rules: RewardRules;
  children: RewardChildBalance[];
}
