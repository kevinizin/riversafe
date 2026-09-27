import type { Env } from '@woh/config';
import type { Db } from '@woh/db';
import { AppError } from '../domain/errors.js';
import { logger } from '../logging/logger.js';
import { AnthropicProvider } from './anthropic.js';
import { DisabledAiProvider } from './disabled.js';
import type { AiProvider, AiRequest, AiResponse } from './types.js';

export * from './types.js';
export { DisabledAiProvider } from './disabled.js';
export { AnthropicProvider } from './anthropic.js';

export function buildAiProvider(env: Env): AiProvider {
  if (env.AI_PROVIDER === 'anthropic') {
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL });
  }
  return new DisabledAiProvider();
}

/** Spend so far this calendar month, in GBP. */
export async function monthToDateSpend(db: Db, now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db.aiUsage.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { estimatedCostGbp: true },
  });
  return result._sum.estimatedCostGbp ?? 0;
}

/**
 * Calls the model, but only when the monthly budget allows and the caller has
 * genuinely exhausted the deterministic route.
 *
 * Every call is recorded in `ai_usage`, so the cost of the AI features is a
 * number on the dashboard rather than a surprise on an invoice.
 */
export async function completeWithBudget(
  provider: AiProvider,
  db: Db,
  env: Env,
  request: AiRequest,
): Promise<AiResponse> {
  if (!provider.isConfigured()) {
    throw new AppError('PROVIDER_NOT_CONFIGURED', 'AI is not enabled for this installation');
  }

  const spent = await monthToDateSpend(db);
  if (spent >= env.AI_MONTHLY_BUDGET_GBP) {
    throw new AppError(
      'BUDGET_EXCEEDED',
      `AI monthly budget of £${env.AI_MONTHLY_BUDGET_GBP.toFixed(2)} is already spent (£${spent.toFixed(2)})`,
    );
  }

  const response = await provider.complete(request);

  await db.aiUsage
    .create({
      data: {
        purpose: request.purpose,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCostGbp: response.estimatedCostGbp,
        ...(request.companyId ? { companyId: request.companyId } : {}),
      },
    })
    .catch((err: unknown) => {
      logger.warn('ai.usage_not_recorded', 'AI call succeeded but usage was not recorded', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  return response;
}
