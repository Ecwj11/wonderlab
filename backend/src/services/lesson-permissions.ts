import { canCreateLessons, type User } from '@wonderlab/shared';
import { ApiError } from '../http.js';
export function assertLessonCreator(user: User) {
  if (!canCreateLessons(user))
    throw new ApiError(
      403,
      'GENERATION_RESTRICTED',
      'Your parent creates lessons for your family.',
    );
}
