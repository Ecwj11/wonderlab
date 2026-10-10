import { it, expect } from 'vitest';
import { OpenAIProvider, AnthropicProvider, GeminiProvider } from '../src/providers/http.js';
import { MockAIProvider } from '../src/providers/mock.js';
import type { GenerateInput } from '@wonderlab/shared';
import { config } from '../src/config.js';
const input: GenerateInput = {
  title: 'Test fractions',
  subject: 'MATHEMATICS',
  language: 'English',
  schoolLevel: 'Primary 4',
  content: 'Fractions are equal parts of a whole.',
  inputType: 'TEXT',
};
it('includes Gemini thinking tokens in billable output usage and cost', async () => {
  const originalInputRate = config.AI_INPUT_COST_PER_MILLION;
  const originalOutputRate = config.AI_OUTPUT_COST_PER_MILLION;
  config.AI_INPUT_COST_PER_MILLION = 1;
  config.AI_OUTPUT_COST_PER_MILLION = 2;
  try {
    const provider = new GeminiProvider(
      'test-key',
      'test-model',
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        family: 'fractions',
                        objectives: ['Understand equal parts'],
                        concepts: ['quarter'],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 200,
              thoughtsTokenCount: 300,
            },
          }),
          { status: 200 },
        ),
    );
    await provider.analyzeContent(input);
    expect(provider.getUsage()).toEqual({
      tokensInput: 100,
      tokensOutput: 500,
      estimatedCost: 0.0011,
    });
  } finally {
    config.AI_INPUT_COST_PER_MILLION = originalInputRate;
    config.AI_OUTPUT_COST_PER_MILLION = originalOutputRate;
  }
});
it.each([OpenAIProvider, AnthropicProvider, GeminiProvider])(
  'validates a real-provider shaped JSON response',
  async (Provider) => {
    const mock = new MockAIProvider();
    const { definition } = await mock.generateLesson(input, await mock.analyzeContent(input));
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(definition) } }],
          content: [{ type: 'text', text: JSON.stringify(definition) }],
          candidates: [{ content: { parts: [{ text: JSON.stringify(definition) }] } }],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 360,
            input_tokens: 120,
            output_tokens: 360,
          },
          usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 360 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const provider = new Provider('test-key', 'test-model', fetcher);
    const result = await provider.generateLesson(input, {
      family: 'fractions',
      objectives: [],
      concepts: [],
    });
    expect(result.definition.scenes[0].type).toBe('FRACTION_PIZZA');
    expect(result.usage.tokensOutput).toBe(360);
  },
);
it('rejects provider output containing arbitrary code', async () => {
  const provider = new OpenAIProvider(
    'test-key',
    'test-model',
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"html":"<script>alert(1)</script>"}' } }],
          usage: {},
        }),
        { status: 200 },
      ),
  );
  await expect(
    provider.generateLesson(input, { family: 'generic', objectives: [], concepts: [] }),
  ).rejects.toThrow();
});
it('does not leak provider responses when an API request fails', async () => {
  const provider = new OpenAIProvider(
    'test-key',
    'test-model',
    async () => new Response('secret raw provider error', { status: 429 }),
  );
  await expect(
    provider.generateLesson(input, { family: 'generic', objectives: [], concepts: [] }),
  ).rejects.toThrow('Provider request failed (429)');
});
it.each([OpenAIProvider, AnthropicProvider, GeminiProvider])(
  'uses separate scoped agent prompts and totals all provider calls exactly once',
  async (Provider) => {
    const { generateWithAgents } = await import('../src/services/agent-generation.js');
    const mock = new MockAIProvider();
    const { definition } = await mock.generateLesson(input, await mock.analyzeContent(input));
    const prompts: string[] = [];
    const fetcher: typeof fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      const prompt =
        body.messages?.find((message: { role: string }) => message.role === 'user')?.content ||
        body.contents?.[0].parts[0].text;
      prompts.push(prompt);
      const result = prompt.includes('Role: learning analyst')
        ? { family: 'fractions', objectives: ['Recognize equal parts'], concepts: ['quarter'] }
        : prompt.includes('Role: lesson planner')
          ? definition
          : JSON.parse(prompt.split('\nScene: ')[1].split('\nInput: ')[0]);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(result) } }],
          content: [{ type: 'text', text: JSON.stringify(result) }],
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            input_tokens: 100,
            output_tokens: 200,
          },
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
        }),
        { status: 200 },
      );
    };
    const factory = () => new Provider('test-key', 'test-model', fetcher);
    const result = await generateWithAgents(input, factory(), factory, {
      create: async () => {},
      start: async () => {},
      complete: async () => {},
      fail: async () => {},
      progress: async () => {},
    });
    expect(result.definition).toEqual(definition);
    expect(prompts).toHaveLength(5);
    expect(
      prompts.filter((prompt) => prompt.includes('Design a complete interactive lesson')),
    ).toHaveLength(1);
    expect(
      prompts.filter((prompt) => prompt.includes('Role: scene content specialist')),
    ).toHaveLength(2);
    expect(prompts.filter((prompt) => prompt.includes('Role: quiz specialist'))).toHaveLength(1);
    expect(result.usage.tokensInput).toBe(500);
    expect(result.usage.tokensOutput).toBe(1000);
  },
);
