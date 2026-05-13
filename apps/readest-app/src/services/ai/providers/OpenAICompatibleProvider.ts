import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel, EmbeddingModel } from 'ai';
import type { AIProvider, AISettings, AIProviderName } from '../types';
import { aiLogger } from '../logger';
import { AI_TIMEOUTS } from '../utils/retry';

export class OpenAICompatibleProvider implements AIProvider {
  id: AIProviderName = 'openai-compatible';
  name = 'OpenAI Compatible';
  requiresAuth = true;

  private settings: AISettings;
  private provider: ReturnType<typeof createOpenAI>;

  constructor(settings: AISettings) {
    this.settings = settings;
    if (!settings.openAICompatibleApiKey) {
      throw new Error('API key required for OpenAI-compatible provider');
    }
    this.provider = createOpenAI({
      apiKey: settings.openAICompatibleApiKey,
      baseURL: settings.openAICompatibleBaseUrl || 'https://api.openai.com/v1',
      name: 'openai-compatible',
    });
    aiLogger.provider.init('openai-compatible', settings.openAICompatibleModel || 'gpt-5.2');
  }

  getModel(): LanguageModel {
    return this.provider(this.settings.openAICompatibleModel || 'gpt-5.2');
  }

  getEmbeddingModel(): EmbeddingModel {
    return this.provider.embeddingModel(
      this.settings.openAICompatibleEmbeddingModel || 'text-embedding-3-small',
    );
  }

  async isAvailable(): Promise<boolean> {
    return !!this.settings.openAICompatibleApiKey && !!this.settings.openAICompatibleBaseUrl;
  }

  async healthCheck(): Promise<boolean> {
    const baseUrl = this.settings.openAICompatibleBaseUrl || 'https://api.openai.com/v1';
    const apiKey = this.settings.openAICompatibleApiKey;
    if (!apiKey) return false;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(AI_TIMEOUTS.HEALTH_CHECK),
      });
      return response.ok;
    } catch (e) {
      aiLogger.provider.error('openai-compatible', (e as Error).message);
      return false;
    }
  }
}
