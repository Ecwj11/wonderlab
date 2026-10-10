import { lessonSchema, sceneSchema, type GenerateInput, type Scene } from '@wonderlab/shared';
import type {
  AIProvider,
  Analysis,
  GenerationResult,
  AIUsage,
  SceneTaskContext,
  ProviderContext,
} from './types.js';
import {
  createCodexRequest,
  waitForCodexRequest,
  codexAnalysisSchema,
  type CodexRequestKind,
  type CodexWaitOptions,
} from '../services/codex-bridge.js';

/** This adapter waits for trusted local agents in the current Codex session.
 * Token and cost telemetry is unavailable: zeros are placeholders, not free usage. */
export class CodexSessionProvider implements AIProvider {
  readonly name = 'codex';
  readonly model = 'codex-session-subagent';
  private taskId?: string;
  constructor(
    private context?: ProviderContext,
    private options: CodexWaitOptions = {},
  ) {
    if (!context) throw new Error('Codex generation requires an active generation job');
  }
  setTask(taskId: string): void {
    this.taskId = taskId;
  }
  getUsage(): AIUsage {
    return { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 };
  }
  private async request(kind: CodexRequestKind, payload: unknown): Promise<unknown> {
    if (!this.context) throw new Error('Codex generation requires an active generation job');
    const id = await createCodexRequest({ ...this.context, taskId: this.taskId }, kind, payload);
    return waitForCodexRequest(id, this.options);
  }
  async analyzeContent(input: GenerateInput): Promise<Analysis> {
    return codexAnalysisSchema.parse(await this.request('ANALYZE', { input }));
  }
  async generateLesson(input: GenerateInput, analysis: Analysis): Promise<GenerationResult> {
    return {
      definition: lessonSchema.parse(await this.request('LESSON', { input, analysis })),
      usage: this.getUsage(),
    };
  }
  async generateQuiz(input: GenerateInput): Promise<Extract<Scene, { type: 'QUIZ' }>> {
    const scene = sceneSchema.parse(await this.request('QUIZ', { input }));
    if (scene.type !== 'QUIZ') throw new Error('Codex output changed requested scene type');
    return scene;
  }
  async generateScene(input: GenerateInput, type: Scene['type']): Promise<Scene> {
    return sceneSchema.parse(await this.request('SCENE', { input, type }));
  }
  async regenerateScene(
    input: GenerateInput,
    scene: Scene,
    context?: SceneTaskContext,
  ): Promise<Scene> {
    return sceneSchema.parse(
      await this.request('REGENERATE', { input, scene, ...(context ? { context } : {}) }),
    );
  }
}
