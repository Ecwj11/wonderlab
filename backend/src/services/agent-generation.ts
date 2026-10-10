import { randomUUID } from 'node:crypto';
import {
  lessonSchema,
  sceneSchema,
  type GenerateInput,
  type GenerationAgentRole,
  type LessonDefinition,
  type Scene,
} from '@wonderlab/shared';
import type { AIProvider, AIUsage } from '../providers/types.js';

export interface AgentTask {
  id: string;
  order: number;
  role: GenerationAgentRole;
  name: string;
  sceneId: string | null;
  provider: string;
  model: string;
}
export interface AgentLifecycle {
  create(task: AgentTask): Promise<void>;
  start(task: AgentTask): Promise<void>;
  complete(task: AgentTask, usage: AIUsage): Promise<void>;
  fail(task: AgentTask, usage: AIUsage): Promise<void>;
  progress(value: number, step: string): Promise<void>;
}
const zero = (): AIUsage => ({ tokensInput: 0, tokensOutput: 0, estimatedCost: 0 });
const delta = (after: AIUsage, before: AIUsage): AIUsage => ({
  tokensInput: after.tokensInput - before.tokensInput,
  tokensOutput: after.tokensOutput - before.tokensOutput,
  estimatedCost: after.estimatedCost - before.estimatedCost,
});

/** Constrained, independent AI conversations share a plan, never executable generated code. */
export async function generateWithAgents(
  input: GenerateInput,
  coordinator: AIProvider,
  createSpecialist: () => AIProvider,
  lifecycle: AgentLifecycle,
) {
  let order = 0;
  const total = zero();
  const make = async (
    provider: Pick<AIProvider, 'name' | 'model'>,
    role: GenerationAgentRole,
    name: string,
    sceneId: string | null = null,
  ) => {
    const task = {
      id: randomUUID(),
      order: order++,
      role,
      name,
      sceneId,
      provider: provider.name,
      model: provider.model,
    };
    await lifecycle.create(task);
    return task;
  };
  const perform = async <T>(
    task: AgentTask,
    provider: AIProvider,
    work: () => Promise<T>,
    fallback?: (result: T) => AIUsage,
  ): Promise<T> => {
    await lifecycle.start(task);
    provider.setTask?.(task.id);
    const before = provider.getUsage?.() || zero();
    try {
      const result = await work();
      const usage = provider.getUsage
        ? delta(provider.getUsage(), before)
        : fallback?.(result) || zero();
      await lifecycle.complete(task, usage);
      total.tokensInput += usage.tokensInput;
      total.tokensOutput += usage.tokensOutput;
      total.estimatedCost += usage.estimatedCost;
      return result;
    } catch (error) {
      await lifecycle.fail(task, provider.getUsage ? delta(provider.getUsage(), before) : zero());
      throw error;
    }
  };
  const analyst = await make(coordinator, 'ANALYST', 'Learning analyst');
  await lifecycle.progress(20, 'Learning analyst is finding the big ideas');
  const analysis = await perform(analyst, coordinator, () => coordinator.analyzeContent(input));
  const planner = await make(coordinator, 'PLANNER', 'Lesson planner');
  await lifecycle.progress(40, 'Lesson planner is designing your adventure');
  const planned = await perform(
    planner,
    coordinator,
    async () => {
      const generated = await coordinator.generateLesson(input, analysis);
      const definition = lessonSchema.parse(generated.definition);
      if (
        definition.subject !== input.subject ||
        definition.language !== input.language ||
        definition.scenes.length > 6
      )
        throw new Error('Lesson plan does not match generation constraints');
      if (
        coordinator.name === 'codex' &&
        !['NUMBER_GAME', 'MATCHING'].includes(definition.scenes[0].type)
      )
        throw new Error('Codex lesson plan must begin with a playable game');
      return { ...generated, definition };
    },
    (result) => result.usage,
  );
  const specialists: { task: AgentTask; provider: AIProvider; scene: Scene }[] = [];
  for (const [index, scene] of planned.definition.scenes.entries()) {
    const provider = createSpecialist();
    const quiz = scene.type === 'QUIZ';
    specialists.push({
      provider,
      scene,
      task: await make(
        provider,
        quiz ? 'QUIZ_SPECIALIST' : 'SCENE_SPECIALIST',
        quiz ? 'Quiz specialist' : 'Scene specialist ' + (index + 1),
        scene.id,
      ),
    });
  }
  const validator = await make(
    { name: 'local', model: 'lesson-schema-v1' },
    'VALIDATOR',
    'Lesson validator',
  );
  let completed = 0;
  const scenes: Scene[] = [];
  // Await each whole batch even if one member fails, then stop dispatching pending tasks.
  for (let offset = 0; offset < specialists.length; offset += 2) {
    const batch = specialists.slice(offset, offset + 2);
    const settled = await Promise.allSettled(
      batch.map(({ task, provider, scene }) =>
        perform(task, provider, async () => {
          const result = sceneSchema.parse(
            await provider.regenerateScene(input, scene, {
              role: scene.type === 'QUIZ' ? 'QUIZ_SPECIALIST' : 'SCENE_SPECIALIST',
              objectives: planned.definition.objectives,
              concepts: analysis.concepts,
              siblingScenes: planned.definition.scenes
                .filter((s) => s.id !== scene.id)
                .map(({ id, type, title }) => ({ id, type, title })),
            }),
          );
          if (result.id !== scene.id || result.type !== scene.type)
            throw new Error('Specialist changed scene identity');
          completed++;
          await lifecycle.progress(
            45 + Math.round((completed / specialists.length) * 40),
            'Content specialists are building your activities',
          );
          return result;
        }),
      ),
    );
    const failed = settled.find((s) => s.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    for (const result of settled) if (result.status === 'fulfilled') scenes.push(result.value);
  }
  await lifecycle.progress(90, 'Validating and assembling your lesson');
  const definition = await perform<LessonDefinition>(validator, coordinator, async () =>
    lessonSchema.parse({ ...planned.definition, scenes }),
  );
  return { definition, usage: total };
}
