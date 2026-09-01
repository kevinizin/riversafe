import { AppError } from '../../domain/errors.js';
import type { WebSearchProvider, WebSearchResult } from './types.js';

/**
 * The provider used when no web search API is configured.
 *
 * It throws PROVIDER_NOT_CONFIGURED rather than returning an empty array. That
 * distinction matters: an empty array would let the pipeline conclude "no
 * website found" when in truth nothing was ever searched.
 */
export class DisabledSearchProvider implements WebSearchProvider {
  readonly name = 'disabled';
  isConfigured(): boolean {
    return false;
  }
  async search(): Promise<WebSearchResult[]> {
    throw new AppError(
      'PROVIDER_NOT_CONFIGURED',
      'No web search provider is configured. Set SEARCH_PROVIDER to enable website and social discovery by search.',
    );
  }
}
