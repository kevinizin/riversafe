export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOptions {
  count?: number;
  countryCode?: string;
}

/**
 * A general web search API. Used to *discover candidates* only — every
 * candidate is then verified against the company's own details before it is
 * accepted. A search hit on its own is never treated as proof.
 */
export interface WebSearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}
