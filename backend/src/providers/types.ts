import type { GenerateInput, LessonDefinition, Scene } from '@wonderlab/shared';
export interface Analysis {
  family: 'fractions' | 'history' | 'heart' | 'generic';
  objectives: string[];
  concepts: string[];
}
export interface AIUsage {
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
}
export interface ProviderContext {
  jobId: string;
  attempt: number;
}
export interface GenerationResult {
  definition: LessonDefinition;
  usage: AIUsage;
}
export interface SceneTaskContext {
  role: 'SCENE_SPECIALIST' | 'QUIZ_SPECIALIST';
  objectives: string[];
  concepts: string[];
  siblingScenes: { id: string; type: Scene['type']; title: string }[];
}
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  analyzeContent(input: GenerateInput): Promise<Analysis>;
  generateLesson(input: GenerateInput, analysis: Analysis): Promise<GenerationResult>;
  generateQuiz(input: GenerateInput): Promise<Extract<Scene, { type: 'QUIZ' }>>;
  generateScene(input: GenerateInput, type: Scene['type']): Promise<Scene>;
  regenerateScene(input: GenerateInput, scene: Scene, context?: SceneTaskContext): Promise<Scene>;
  getUsage?(): AIUsage;
  setTask?(taskId: string): void;
}
