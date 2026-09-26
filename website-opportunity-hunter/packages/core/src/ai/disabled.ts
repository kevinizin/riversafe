import { AppError } from '../domain/errors.js';
import type { AiProvider, AiResponse } from './types.js';

/**
 * The default. Every feature that can use AI must also work without it, so this
 * provider exists to make that requirement impossible to forget.
 */
export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';
  isConfigured(): boolean {
    return false;
  }
  async complete(): Promise<AiResponse> {
    throw new AppError('PROVIDER_NOT_CONFIGURED', 'No AI provider is configured (AI_PROVIDER=none)');
  }
}
