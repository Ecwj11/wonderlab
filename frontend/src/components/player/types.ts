import type { PublicScene, QuizResult, Subject, StoryAnswer } from '@wonderlab/shared';
export type ActivityResult = {
  parts?: number;
  selected?: number;
  viewedIds?: string[];
  viewed?: boolean;
  roundAnswers?: { roundId: string; value: number }[];
  matchedIds?: string[];
  storyAnswers?: StoryAnswer[];
};
export interface SceneProps<T extends PublicScene = PublicScene> {
  scene: T;
  subject?: Subject;
  onChange: (result: ActivityResult | null) => void;
  playing: boolean;
  onPlayingChange?: (playing: boolean) => void;
  lessonId: string;
  lessonVersion: number;
  replayFromStart?: boolean;
  onQuizComplete: (result: QuizResult) => void;
}
