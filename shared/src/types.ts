import type { PublicLesson, Subject, Language } from './lesson-schema.js';
export type Role = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
export interface User {
  accountType?: 'ADMIN' | 'PARENT' | 'CHILD' | 'LEARNER';
  familyId?: string | null;
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  roles: Role[];
  xp: number;
  level: number;
  timezone: string;
  createdAt: string;
}
export interface LessonSummary {
  id: string;
  userId: string;
  title: string;
  subject: Subject;
  language: Language;
  schoolLevel: string;
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
  status: 'GENERATING' | 'READY' | 'FAILED';
  schemaVersion: number;
  progress: number;
  bestScore: number | null;
  progressStatus: 'IN_PROGRESS' | 'COMPLETED' | null;
  sceneCount: number;
  createdAt: string;
  ownerName?: string;
}
export interface LessonDetail extends LessonSummary {
  lessonVersion: number;
  definition: PublicLesson | null;
  completedScenes: string[];
}
export type GenerationAgentRole =
  'ANALYST' | 'PLANNER' | 'SCENE_SPECIALIST' | 'QUIZ_SPECIALIST' | 'VALIDATOR';
export interface GenerationAgentTask {
  id: string;
  attempt: number;
  role: GenerationAgentRole;
  name: string;
  sceneId: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  step: string;
  provider: string;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface GenerationJob {
  attempt: number;
  agents: GenerationAgentTask[];
  id: string;
  lessonId: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  step: string;
  provider: string;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
}
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface ProgressStats {
  xp: number;
  level: number;
  completed: number;
  averageScore: number;
  learningMinutes: number;
  learningTodayMinutes: number;
  streak: number;
  longestStreak: number;
  subjectProgress: { subject: Subject; completed: number; total: number; percentage: number }[];
  activity: { date: string; xp: number }[];
}
export interface DashboardData {
  continueLearning: LessonSummary | null;
  user: User;
  stats: ProgressStats;
  recent: LessonSummary[];
  recommended: LessonSummary[];
  provider: string;
  dailyGoalMinutes: number;
}
export interface QuizResult {
  score: number;
  correct: number;
  total: number;
  xpEarned: number;
  totalXp: number;
  lessonCompleted: boolean;
  alreadySubmitted: boolean;
  feedback: {
    questionId: string;
    correct: boolean;
    correctOptionId: string;
    explanation: string;
  }[];
}
