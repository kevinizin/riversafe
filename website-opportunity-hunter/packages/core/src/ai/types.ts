export interface AiRequest {
  /** What the call is for. Used for cost accounting and for prompt selection. */
  purpose: 'industry_classification' | 'company_summary' | 'opportunity_explanation' | 'outreach_personalisation' | 'website_briefing';
  system: string;
  prompt: string;
  maxTokens?: number;
  companyId?: string;
}

export interface AiResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostGbp: number;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(request: AiRequest): Promise<AiResponse>;
}
