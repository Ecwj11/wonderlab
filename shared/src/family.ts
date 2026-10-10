import { z } from 'zod';
import type { Subject } from './lesson-schema.js';
import type { ProgressStats } from './types.js';

export const schoolGrades = [
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'Secondary 1',
  'Secondary 2',
  'Secondary 3',
  'Secondary 4',
  'Secondary 5',
] as const;
export type SchoolGrade = (typeof schoolGrades)[number];

// Legacy broad labels describe all grades in that school stage. A range is
// available if it covers at least one grade the parent has selected.
export function schoolGradesForLevel(level: string): SchoolGrade[] {
  const match = /^(primary|secondary)(?:\s+school)?(?:\s+(\d)(?:\s*[-–—]\s*(\d))?)?$/i.exec(
    level.trim(),
  );
  if (!match) return [];
  const stage = match[1].toLowerCase() === 'primary' ? 'Primary' : 'Secondary';
  const max = stage === 'Primary' ? 6 : 5;
  const start = match[2] ? Number(match[2]) : 1;
  const end = match[3] ? Number(match[3]) : match[2] ? start : max;
  if (start < 1 || end > max || start > end) return [];
  return schoolGrades.filter((grade) => {
    const [name, number] = grade.split(' ');
    return name === stage && Number(number) >= start && Number(number) <= end;
  });
}
export function isSchoolLevelAllowed(level: string, allowed: readonly SchoolGrade[] | null) {
  return allowed === null || schoolGradesForLevel(level).some((grade) => allowed.includes(grade));
}

const subjects = ['MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'GENERAL'] as const;
export const planInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  priceMonthlyCents: z.number().int().min(0).max(1000000),
  childLimit: z.number().int().min(1).max(20),
  generationLimit: z.number().int().min(1).max(1000),
  trialDays: z.number().int().min(0).max(90),
  isActive: z.boolean(),
});
export type PlanInput = z.infer<typeof planInputSchema>;
export interface SubscriptionPlan extends PlanInput {
  id: string;
  currency: 'MYR';
  createdAt: string;
}
export const childCreateSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),
  passcode: z.string().min(6).max(72),
  schoolLevel: z.string().trim().min(2).max(64),
  avatar: z.enum(['fox', 'owl', 'panda', 'rocket']).default('fox'),
  canGenerate: z.boolean().default(false),
  allowedSubjects: z
    .array(z.enum(subjects))
    .min(1)
    .max(5)
    .refine((v) => new Set(v).size === v.length)
    .default([...subjects]),
  allowedSchoolLevels: z
    .array(z.enum(schoolGrades))
    .min(1)
    .max(schoolGrades.length)
    .refine((levels) => new Set(levels).size === levels.length)
    .nullable()
    .default(null),
  dailyMinutesLimit: z.number().int().min(5).max(240).default(30),
});
export const childUpdateSchema = childCreateSchema
  .omit({ passcode: true, username: true })
  .partial()
  .extend({
    avatar: childCreateSchema.shape.avatar.removeDefault().optional(),
    canGenerate: childCreateSchema.shape.canGenerate.removeDefault().optional(),
    allowedSubjects: childCreateSchema.shape.allowedSubjects.removeDefault().optional(),
    allowedSchoolLevels: childCreateSchema.shape.allowedSchoolLevels.removeDefault().optional(),
    dailyMinutesLimit: childCreateSchema.shape.dailyMinutesLimit.removeDefault().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide a change');
export type ChildCreateInput = z.infer<typeof childCreateSchema>;
export type ChildUpdateInput = z.infer<typeof childUpdateSchema>;
export interface FamilyChild {
  id: string;
  name: string;
  username: string;
  schoolLevel: string;
  avatar: ChildCreateInput['avatar'];
  status: 'ACTIVE' | 'SUSPENDED';
  canGenerate: boolean;
  allowedSubjects: Subject[];
  allowedSchoolLevels: SchoolGrade[] | null;
  dailyMinutesLimit: number;
  learningSecondsToday: number;
  stats: ProgressStats;
  createdAt: string;
}
export interface FamilySummary {
  id: string;
  parentId: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
}
export interface LearningAccess {
  familyId: string | null;
  familyName: string | null;
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'NONE' | 'SUSPENDED';
  canLearn: boolean;
  canGenerate: boolean;
  reason: string | null;
  childLimit: number;
  generationLimit: number;
  generationUsed: number;
  periodEndsAt: string | null;
  allowedSubjects: Subject[];
  allowedSchoolLevels: SchoolGrade[] | null;
  dailyMinutesLimit: number | null;
  learningSecondsToday: number;
}
export interface FamilySubscription {
  id: string;
  familyId: string;
  familyName: string;
  parentName: string;
  parentEmail: string;
  planId: string;
  planName: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  priceMonthlyCents: number;
  childLimit: number;
  generationLimit: number;
  currency: 'MYR';
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}
export type SubscriptionRequest = FamilySubscription;
export interface FamilyDashboard {
  family: FamilySummary;
  access: LearningAccess;
  children: FamilyChild[];
  subscription: FamilySubscription | null;
  pendingSubscription: FamilySubscription | null;
}
export interface FamilyBilling extends FamilyDashboard {
  plans: SubscriptionPlan[];
  history: FamilySubscription[];
}
export interface AdminFamily extends FamilySummary {
  parentName: string;
  parentEmail: string;
  childCount: number;
  access: LearningAccess;
}
