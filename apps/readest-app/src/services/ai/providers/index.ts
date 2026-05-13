import { OllamaProvider } from './OllamaProvider';
import { AIGatewayProvider } from './AIGatewayProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import type { AIProvider, AISettings } from '../types';

export { OllamaProvider, AIGatewayProvider, OpenAICompatibleProvider };

export function getAIProvider(settings: AISettings): AIProvider {
  switch (settings.provider) {
    case 'ollama':
      return new OllamaProvider(settings);
    case 'ai-gateway':
      if (!settings.aiGatewayApiKey) {
        throw new Error('API key required for AI Gateway');
      }
      return new AIGatewayProvider(settings);
    case 'openai-compatible':
      if (!settings.openAICompatibleApiKey) {
        throw new Error('API key required for OpenAI-compatible provider');
      }
      return new OpenAICompatibleProvider(settings);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
