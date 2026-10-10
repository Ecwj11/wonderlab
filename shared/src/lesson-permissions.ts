import type { User } from './types.js';

// Child creation is paused for now; the stored family setting is kept for future rollout.
export const canCreateLessons = (user: Pick<User, 'accountType'> | null | undefined) =>
  !!user && user.accountType !== 'CHILD';
export const lessonCreationPath = (user: Pick<User, 'accountType'> | null | undefined) =>
  user?.accountType === 'PARENT' ? '/parent/create' : '/app/create';
