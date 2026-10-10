import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { lessonSchema, type GenerateInput, type Scene } from '@wonderlab/shared';
import type { AIProvider } from '../src/providers/types.js';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Codex bridge tests require a database ending in _test');
const { pool, rows, run } = await import('../src/db/pool.js');
const { migrate } = await import('../src/db/migrate.js');
const bridge = await import('../src/services/codex-bridge.js');
const { CodexSessionProvider } = await import('../src/providers/codex-session.js');
const { generateWithAgents } = await import('../src/services/agent-generation.js');
const { OpenAIProvider } = await import('../src/providers/http.js');
const input = {
  title: 'Water cycle',
  subject: 'GENERAL' as const,
  language: 'English' as const,
  schoolLevel: 'Primary 4',
  inputType: 'TEXT' as const,
  content: 'Water evaporates, condenses into clouds and falls as rain.',
};
const analysis = {
  family: 'generic' as const,
  objectives: ['Explain evaporation'],
  concepts: ['Evaporation'],
};
const userId = randomUUID();
const matchingGame = {
  id: 'water-game',
  type: 'MATCHING' as const,
  title: 'Match the water journey',
  explanation: 'Water changes as it moves through the cycle.',
  instructions: 'Match each process to what happens.',
  pairs: [
    { id: 'evaporation', left: 'Evaporation', right: 'Liquid water becomes water vapour' },
    { id: 'condensation', left: 'Condensation', right: 'Water vapour forms tiny liquid droplets' },
  ],
};
const numberGame = {
  id: 'number-game',
  type: 'NUMBER_GAME' as const,
  title: 'Build and count',
  explanation: 'Combine blocks to add; remove blocks to subtract.',
  instructions: 'Use the blocks, then choose your answer.',
  rounds: [
    { id: 'add', left: 3, right: 2, operation: 'ADD' as const },
    { id: 'subtract', left: 5, right: 2, operation: 'SUBTRACT' as const },
  ],
};
const readingScene = {
  id: 'water-reading',
  type: 'STORY' as const,
  title: 'Water cycle',
  explanation: 'Water moves in a cycle.',
  paragraphs: ['Sunlight warms water.'],
};
const lessonPlan = (scenes: unknown[]) => ({
  lessonSchemaVersion: 1,
  title: input.title,
  subject: input.subject,
  language: input.language,
  objectives: analysis.objectives,
  scenes,
});
const lifecycle = {
  create: async () => {},
  start: async () => {},
  complete: async () => {},
  fail: async () => {},
  progress: async () => {},
};
function plannedProvider(plan: unknown, name = 'codex'): AIProvider {
  return {
    name,
    model: 'test-game-author',
    analyzeContent: async () => analysis,
    generateLesson: async () => ({
      definition: lessonSchema.parse(plan),
      usage: { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 },
    }),
    generateQuiz: async () => {
      throw new Error('Unused test operation');
    },
    generateScene: async () => lessonSchema.parse(plan).scenes[0],
    regenerateScene: async (_input: GenerateInput, scene: Scene) => scene,
  };
}
beforeAll(async () => {
  await migrate();
  await run("INSERT IGNORE INTO subjects(id,name,color) VALUES('GENERAL','General','#123456')");
  await run('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)', [
    userId,
    'Bridge fixture',
    userId + '@example.com',
    'fixture-only',
  ]);
});
afterAll(async () => {
  await run('DELETE FROM users WHERE id=?', [userId]);
  await pool.end();
});
async function fixture() {
  const jobId = randomUUID(),
    lessonId = randomUUID(),
    taskId = randomUUID();
  await run(
    'INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,source_content,current_job_id) VALUES(?,?,?,?,?,?,?,?)',
    [
      lessonId,
      userId,
      input.title,
      input.subject,
      input.language,
      input.schoolLevel,
      input.content,
      jobId,
    ],
  );
  await run(
    "INSERT INTO generation_jobs(id,user_id,lesson_id,input_type,input_content,provider,status,attempts,heartbeat_at) VALUES(?,?,?,'TEXT',?,'codex','PROCESSING',1,UTC_TIMESTAMP(3))",
    [jobId, userId, lessonId, input.content],
  );
  await run(
    "INSERT INTO generation_agent_tasks(id,job_id,attempt,task_order,role,name,provider,status) VALUES(?,?,1,1,'ANALYST','Bridge analyst','codex','PROCESSING')",
    [taskId, jobId],
  );
  return { jobId, attempt: 1, taskId, lessonId };
}
async function request() {
  const ctx = await fixture();
  const id = await bridge.createCodexRequest(ctx, 'ANALYZE', { input });
  return { ...ctx, id };
}
async function stop(id: string) {
  await run("UPDATE codex_bridge_requests SET status='CANCELLED' WHERE id=?", [id]);
}
describe('durable Codex session bridge', () => {
  it('rejects reading-only plans and plans that postpone their game', () => {
    expect(() =>
      bridge.validateCodexOutput('LESSON', { input, analysis }, lessonPlan([readingScene])),
    ).toThrow('begin with a playable');
    expect(() =>
      bridge.validateCodexOutput(
        'LESSON',
        { input, analysis },
        lessonPlan([readingScene, matchingGame]),
      ),
    ).toThrow('begin with a playable');
    expect(() =>
      bridge.validateCodexOutput(
        'LESSON',
        { input, analysis },
        lessonPlan([
          matchingGame,
          ...Array.from({ length: 6 }, (_, index) => ({ ...readingScene, id: 'reading-' + index })),
        ]),
      ),
    ).toThrow('at most six');
  });
  it.each([matchingGame, numberGame])(
    'accepts a playable $type opening with no required quiz',
    (game) => {
      const plan = lessonPlan([game]);
      expect(bridge.validateCodexOutput('LESSON', { input, analysis }, plan)).toEqual(plan);
    },
  );
  it('preserves regenerated game identities and supports game sibling context', () => {
    const payload = {
      input,
      scene: matchingGame,
      context: {
        role: 'SCENE_SPECIALIST',
        objectives: analysis.objectives,
        concepts: analysis.concepts,
        siblingScenes: [{ id: numberGame.id, type: numberGame.type, title: numberGame.title }],
      },
    };
    expect(bridge.validateCodexOutput('REGENERATE', payload, matchingGame)).toEqual(matchingGame);
    expect(() =>
      bridge.validateCodexOutput('REGENERATE', payload, { ...matchingGame, id: 'changed' }),
    ).toThrow('identity');
    expect(() =>
      bridge.validateCodexOutput('REGENERATE', payload, { ...numberGame, id: matchingGame.id }),
    ).toThrow('identity');
  });
  it('blocks a reading-first Codex plan before specialist dispatch and accepts game-first plans', async () => {
    const rejected = plannedProvider(lessonPlan([readingScene, matchingGame]));
    let dispatched = 0;
    await expect(
      generateWithAgents(
        input,
        rejected,
        () => {
          dispatched++;
          return rejected;
        },
        lifecycle,
      ),
    ).rejects.toThrow('begin with a playable game');
    expect(dispatched).toBe(0);
    const accepted = plannedProvider(lessonPlan([matchingGame]));
    const generated = await generateWithAgents(input, accepted, () => accepted, lifecycle);
    expect(generated.definition.scenes).toEqual([matchingGame]);
    // Legacy/mock lesson fixtures keep their existing supported interactions.
    const legacy = plannedProvider(lessonPlan([readingScene]), 'mock');
    await expect(
      generateWithAgents(input, legacy, () => legacy, lifecycle),
    ).resolves.toHaveProperty('definition.scenes', [readingScene]);
  });
  it('guides external providers toward games while making quizzes optional', async () => {
    let prompt = '';
    const plan = lessonPlan([matchingGame]);
    const provider = new OpenAIProvider('test-key', 'test-model', async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }], usage: {} }),
        { status: 200 },
      );
    });
    await provider.generateLesson(input, analysis);
    expect(prompt).toContain('Begin with a playable NUMBER_GAME or MATCHING');
    expect(prompt).toContain('A short QUIZ is optional');
    expect(prompt).toContain('collect clues');
    expect(prompt).toContain('physically reach the exit');
  });
  it('rejects provider construction without an active job context', () => {
    expect(() => new CodexSessionProvider()).toThrow('active generation job');
  });
  it('serializes concurrent completions for separate tasks on the same job', async () => {
    const ctx = await fixture(),
      secondTaskId = randomUUID();
    await run(
      "INSERT INTO generation_agent_tasks(id,job_id,attempt,task_order,role,name,provider,status) VALUES(?,?,1,2,'ANALYST','Second bridge analyst','codex','PROCESSING')",
      [secondTaskId, ctx.jobId],
    );
    const firstId = await bridge.createCodexRequest(ctx, 'ANALYZE', { input });
    const secondId = await bridge.createCodexRequest({ ...ctx, taskId: secondTaskId }, 'ANALYZE', {
      input,
    });
    const first = await bridge.claimCodexRequest('first-completion'),
      second = await bridge.claimCodexRequest('second-completion');
    expect(new Set([first?.id, second?.id])).toEqual(new Set([firstId, secondId]));
    await Promise.all([
      bridge.completeCodexRequest(first!.id, first!.claimToken, analysis),
      bridge.completeCodexRequest(second!.id, second!.claimToken, analysis),
    ]);
    const completed = await rows<{ status: string }>(
      'SELECT status FROM codex_bridge_requests WHERE id IN (?,?)',
      [firstId, secondId],
    );
    expect(completed.map((row) => row.status)).toEqual(['COMPLETED', 'COMPLETED']);
  });
  it('renews a live lease and stores only a static failure message', async () => {
    const r = await request(),
      claim = await bridge.claimCodexRequest('lease-worker', 10);
    await bridge.renewCodexRequest(r.id, claim!.claimToken, 300);
    const [lease] = await rows<{ seconds: number }>(
      'SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(3),lease_expires_at) seconds FROM codex_bridge_requests WHERE id=?',
      [r.id],
    );
    expect(lease.seconds).toBeGreaterThan(290);
    await bridge.failCodexRequest(r.id, claim!.claimToken);
    const [failed] = await rows<{ status: string; error_message: string }>(
      'SELECT status,error_message FROM codex_bridge_requests WHERE id=?',
      [r.id],
    );
    expect(failed.status).toBe('FAILED');
    expect(failed.error_message).toBe(
      'The Codex session agent could not prepare its assigned content.',
    );
    await expect(bridge.renewCodexRequest(r.id, claim!.claimToken)).rejects.toThrow('claim');
  });
  it('claims each request exclusively and replaces expired claim tokens', async () => {
    const r = await request();
    const results = await Promise.all([
      bridge.claimCodexRequest('one'),
      bridge.claimCodexRequest('two'),
    ]);
    const claims = results.filter((v) => v !== null);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.id).toBe(r.id);
    const old = claims[0]!;
    await run(
      'UPDATE codex_bridge_requests SET lease_expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',
      [r.id],
    );
    const next = await bridge.claimCodexRequest('replacement');
    expect(next?.id).toBe(r.id);
    expect(next?.claimToken).not.toBe(old.claimToken);
    await expect(bridge.completeCodexRequest(r.id, old.claimToken, analysis)).rejects.toThrow(
      'claim',
    );
    await bridge.completeCodexRequest(r.id, next!.claimToken, analysis);
    await expect(bridge.completeCodexRequest(r.id, next!.claimToken, analysis)).rejects.toThrow(
      'claim',
    );
  });
  it('rejects HTML and malformed output without persisting or publishing it', async () => {
    const r = await request(),
      claim = await bridge.claimCodexRequest('validator');
    await expect(
      bridge.completeCodexRequest(r.id, claim!.claimToken, {
        ...analysis,
        concepts: ['<script>alert(1)</script>'],
      }),
    ).rejects.toThrow();
    await expect(
      bridge.completeCodexRequest(r.id, claim!.claimToken, {
        family: 'generic',
        objectives: [],
        concepts: [],
      }),
    ).rejects.toThrow();
    const [stored] = await rows<{ status: string; output_json: unknown }>(
      'SELECT status,output_json FROM codex_bridge_requests WHERE id=?',
      [r.id],
    );
    expect(stored.status).toBe('PROCESSING');
    expect(stored.output_json).toBeNull();
    expect(
      await rows('SELECT id FROM lesson_versions WHERE lesson_id=?', [r.lessonId]),
    ).toHaveLength(0);
    await stop(r.id);
  });
  it('fences lost attempts and terminal tasks, cancelling their outstanding requests', async () => {
    const r = await request(),
      claim = await bridge.claimCodexRequest('stale');
    await run('UPDATE generation_jobs SET attempts=2 WHERE id=?', [r.jobId]);
    await expect(bridge.completeCodexRequest(r.id, claim!.claimToken, analysis)).rejects.toThrow();
    await bridge.recoverCodexRequests();
    expect(
      (
        await rows<{ status: string }>('SELECT status FROM codex_bridge_requests WHERE id=?', [
          r.id,
        ])
      )[0].status,
    ).toBe('CANCELLED');
    const task = await request();
    await run("UPDATE generation_agent_tasks SET status='FAILED' WHERE id=?", [task.taskId]);
    await bridge.recoverCodexRequests();
    expect(
      (
        await rows<{ status: string }>('SELECT status FROM codex_bridge_requests WHERE id=?', [
          task.id,
        ])
      )[0].status,
    ).toBe('CANCELLED');
  });
  it('waits asynchronously for a session consumer and returns validated content', async () => {
    const ctx = await fixture(),
      provider = new CodexSessionProvider(ctx, { pollIntervalMs: 10, timeoutMs: 1000 });
    provider.setTask(ctx.taskId);
    const pending = provider.analyzeContent(input);
    let claim: Awaited<ReturnType<typeof bridge.claimCodexRequest>> = null;
    for (let i = 0; i < 20 && !claim; i++) {
      claim = await bridge.claimCodexRequest('session-subagent');
      if (!claim) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(claim?.kind).toBe('ANALYZE');
    expect(claim?.taskId).toBe(ctx.taskId);
    expect(claim?.payload).toEqual({ input });
    expect(claim?.instructions).toContain('untrusted');
    expect(claim?.instructions).toContain('collect clues');
    expect(claim?.instructions).toContain('physically reach the exit');
    expect(claim?.outputSchema).toHaveProperty('properties');
    await bridge.completeCodexRequest(claim!.id, claim!.claimToken, analysis);
    await expect(pending).resolves.toEqual(analysis);
    expect(provider.getUsage()).toEqual({ tokensInput: 0, tokensOutput: 0, estimatedCost: 0 });
  });
  it('preserves scene identity and lesson subject/language at the boundary', async () => {
    const ctx = await fixture();
    const scene = {
      id: 'water',
      type: 'STORY' as const,
      title: 'Water',
      explanation: 'Water moves in a cycle.',
      paragraphs: ['Sunlight warms water.'],
    };
    const id = await bridge.createCodexRequest(ctx, 'REGENERATE', { input, scene });
    const claim = await bridge.claimCodexRequest('scene');
    await expect(
      bridge.completeCodexRequest(id, claim!.claimToken, { ...scene, id: 'changed' }),
    ).rejects.toThrow();
    await stop(id);
    const lessonId = await bridge.createCodexRequest(ctx, 'LESSON', { input, analysis });
    const lesson = await bridge.claimCodexRequest('planner');
    const output = {
      lessonSchemaVersion: 1,
      title: input.title,
      subject: 'SCIENCE',
      language: 'English',
      objectives: analysis.objectives,
      scenes: [matchingGame],
    };
    await expect(
      bridge.completeCodexRequest(lessonId, lesson!.claimToken, output),
    ).rejects.toThrow();
    await stop(lessonId);
  });
  it('cancels timed out requests and prevents a late consumer from completing them', async () => {
    const ctx = await fixture(),
      provider = new CodexSessionProvider(ctx, { pollIntervalMs: 5, timeoutMs: 30 });
    provider.setTask(ctx.taskId);
    const pending = provider.analyzeContent(input);
    const rejection = expect(pending).rejects.toThrow('timed out');
    let claim = await bridge.claimCodexRequest('slow');
    for (let i = 0; i < 10 && !claim; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      claim = await bridge.claimCodexRequest('slow');
    }
    await rejection;
    expect(claim).not.toBeNull();
    await expect(
      bridge.completeCodexRequest(claim!.id, claim!.claimToken, analysis),
    ).rejects.toThrow();
  });
});
