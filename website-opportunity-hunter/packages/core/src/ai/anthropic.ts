import { AppError } from '../domain/errors.js';
import type { AiProvider, AiRequest, AiResponse } from './types.js';

/**
 * Claude via the Anthropic SDK.
 *
 * The SDK is imported lazily so a deployment with AI_PROVIDER=none never loads
 * it. Pricing is configuration, not a hardcoded truth: rates change, and a
 * stale constant would quietly misreport spend, so `pricePerMTokens` is
 * injectable and defaults are documented in README.md.
 */
export interface AnthropicOptions {
  apiKey: string;
  model: string;
  /** GBP per million tokens. Override to match your current rate card. */
  pricePerMTokens?: { input: number; output: number };
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client: unknown;

  constructor(private readonly options: AnthropicOptions) {}

  isConfigured(): boolean {
    return this.options.apiKey.trim().length > 0;
  }

  private async getClient(): Promise<{
    messages: {
      create(args: unknown): Promise<{
        content: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      }>;
    };
  }> {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: this.options.apiKey });
    }
    return this.client as never;
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    if (!this.isConfigured()) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set');
    }
    const client = await this.getClient();
    let message;
    try {
      message = await client.messages.create({
        model: this.options.model,
        max_tokens: request.maxTokens ?? 700,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
      });
    } catch (err) {
      throw new AppError('PROVIDER_UNAVAILABLE', `anthropic: ${(err as Error).message}`, {
        retryable: true,
        cause: err,
      });
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const rates = this.options.pricePerMTokens ?? { input: 2.4, output: 12 };

    return {
      text,
      model: this.options.model,
      inputTokens,
      outputTokens,
      estimatedCostGbp:
        (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output,
    };
  }
}
