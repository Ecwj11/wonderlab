import { config } from '../config.js';
import { MockAIProvider } from './mock.js';
import { OpenAIProvider, AnthropicProvider, GeminiProvider } from './http.js';
import type { AIProvider, ProviderContext } from './types.js';
import { CodexSessionProvider } from './codex-session.js';
import { ApiError } from '../http.js';

export function assertProviderConfigured() {
  if (config.AI_PROVIDER === 'mock' || config.AI_PROVIDER === 'codex') return;
  const key = {
    openai: config.OPENAI_API_KEY,
    anthropic: config.ANTHROPIC_API_KEY,
    gemini: config.GEMINI_API_KEY,
  }[config.AI_PROVIDER];
  if (!key?.trim())
    throw new ApiError(
      503,
      'AI_NOT_CONFIGURED',
      'Lesson generation is temporarily unavailable. Please try again later.',
    );
}
export function createProvider(context?: ProviderContext): AIProvider {
  switch (config.AI_PROVIDER) {
    case 'mock':
      return new MockAIProvider();
    case 'codex':
      return new CodexSessionProvider(context);
    case 'openai':
      return new OpenAIProvider(config.OPENAI_API_KEY || '', config.AI_MODEL || 'gpt-4.1-mini');
    case 'anthropic':
      return new AnthropicProvider(
        config.ANTHROPIC_API_KEY || '',
        config.AI_MODEL || 'claude-sonnet-4-5',
      );
    case 'gemini':
      return new GeminiProvider(config.GEMINI_API_KEY || '', config.AI_MODEL || 'gemini-2.5-flash');
  }
}
