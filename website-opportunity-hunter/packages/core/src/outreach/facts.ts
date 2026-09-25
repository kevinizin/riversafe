import type { Confidence } from '../domain/types.js';
import { industryLabel } from '../industry/taxonomy.js';
import { platformLabel } from '../scoring/opportunity.js';

/**
 * A single thing the outreach message is permitted to say.
 *
 * The generator may only assemble statements from this list. That is the entire
 * mechanism preventing invented observations: if a claim is not backed by a row
 * in the database, there is no fact for it, and the template has nothing to put
 * in the sentence.
 */
export interface OutreachFact {
  key: string;
  /** The clause as it may appear in a message, in the second person. */
  statement: string;
  /** What in our data supports it. Shown to the operator before sending. */
  evidence: string;
  source: string;
  sourceUrl?: string;
  confidence: Confidence;
  /** Observation facts can fill the "I noticed ..." line; context facts cannot. */
  kind: 'observation' | 'context';
}

export interface FactInput {
  companyName: string;
  city?: string | null;
  incorporationDate?: Date | null;
  registryUrl?: string | null;
  industryKey?: string | null;
  websiteStatus: string;
  websiteStatusNote?: string | null;
  websiteDomain?: string | null;
  websiteQualityScore?: number | null;
  websiteWeaknesses?: string[];
  socialProfiles?: { platform: string; url: string; confidence: Confidence }[];
  reviewCount?: number | null;
  rating?: number | null;
  signals?: { type: string; evidence: string; confidence: Confidence; sourceUrl?: string | null }[];
  now?: Date;
}

const DAY_MS = 86_400_000;

export function buildOutreachFacts(input: FactInput): OutreachFact[] {
  const now = input.now ?? new Date();
  const facts: OutreachFact[] = [];

  if (input.incorporationDate) {
    const days = Math.floor((now.getTime() - input.incorporationDate.getTime()) / DAY_MS);
    if (days >= 0 && days <= 120) {
      facts.push({
        key: 'recent_incorporation',
        statement: `você abriu a ${input.companyName} ${days <= 1 ? 'esta semana' : `há ${days} dias`}`,
        evidence: `o registro público informa data de abertura em ${input.incorporationDate.toISOString().slice(0, 10)}`,
        source: 'companies_house',
        ...(input.registryUrl ? { sourceUrl: input.registryUrl } : {}),
        confidence: 'HIGH',
        kind: 'observation',
      });
    }
  }

  if (input.websiteStatus === 'NO_WEBSITE_FOUND') {
    facts.push({
      key: 'no_website_found',
      // Phrased as what we did, not as a claim about what the business has.
      statement: `não consegui encontrar um site da ${input.companyName}`,
      evidence: input.websiteStatusNote ?? 'nenhum site encontrado por nenhum método de busca permitido',
      source: 'website_discovery',
      confidence: 'MEDIUM',
      kind: 'observation',
    });
  }

  if (input.websiteStatus === 'WEBSITE_FOUND' && input.websiteDomain) {
    if (typeof input.websiteQualityScore === 'number') {
      facts.push({
        key: 'website_score',
        statement: `dei uma olhada no ${input.websiteDomain}`,
        evidence: `a verificação automática pontuou a página inicial em ${input.websiteQualityScore}/100`,
        source: `website:${input.websiteDomain}`,
        sourceUrl: `https://${input.websiteDomain}`,
        confidence: 'HIGH',
        kind: 'context',
      });
    }
    for (const [index, weakness] of (input.websiteWeaknesses ?? []).slice(0, 3).entries()) {
      facts.push({
        key: `website_weakness_${index}`,
        statement: lowerFirst(weakness),
        evidence: `análise da página inicial de ${input.websiteDomain}`,
        source: `website:${input.websiteDomain}`,
        sourceUrl: `https://${input.websiteDomain}`,
        confidence: 'HIGH',
        kind: 'observation',
      });
    }
  }

  for (const profile of input.socialProfiles ?? []) {
    if (profile.platform === 'GOOGLE_BUSINESS') continue;
    facts.push({
      key: `social_${profile.platform.toLowerCase()}`,
      statement: `vocês estão no ${platformLabel(profile.platform as never)}`,
      evidence: `perfil encontrado em ${profile.url}`,
      source: 'social_discovery',
      sourceUrl: profile.url,
      confidence: profile.confidence,
      kind: 'observation',
    });
  }

  if (typeof input.reviewCount === 'number' && input.reviewCount > 0) {
    const rating = typeof input.rating === 'number' ? `, com nota ${input.rating.toFixed(1)}` : '';
    facts.push({
      key: 'reviews',
      statement: `vocês têm ${input.reviewCount} avaliações${rating}`,
      evidence: `a ficha do negócio informa ${input.reviewCount} avaliações${rating}`,
      source: 'places_provider',
      confidence: 'HIGH',
      kind: 'observation',
    });
  }

  for (const signal of input.signals ?? []) {
    if (signal.type === 'RECENT_INCORPORATION') continue;
    const statement = SIGNAL_STATEMENTS[signal.type];
    if (!statement) continue;
    facts.push({
      key: `signal_${signal.type.toLowerCase()}`,
      statement,
      evidence: signal.evidence,
      source: 'activity_signals',
      ...(signal.sourceUrl ? { sourceUrl: signal.sourceUrl } : {}),
      confidence: signal.confidence,
      kind: 'observation',
    });
  }

  if (input.industryKey) {
    facts.push({
      key: 'industry',
      statement: `vocês atuam em ${industryLabel(input.industryKey).toLowerCase()}`,
      evidence: 'classificado pelo código de atividade registrado e pelo nome da empresa',
      source: 'industry_classification',
      confidence: 'MEDIUM',
      kind: 'context',
    });
  }

  if (input.city) {
    facts.push({
      key: 'location',
      statement: `vocês ficam em ${input.city}`,
      evidence: 'endereço registrado da empresa',
      source: 'companies_house',
      confidence: 'HIGH',
      kind: 'context',
    });
  }

  return facts;
}

const SIGNAL_STATEMENTS: Record<string, string> = {
  NOW_OPEN: 'o site de vocês diz que acabaram de abrir',
  GRAND_OPENING: 'o site de vocês menciona uma inauguração',
  OPENING_SOON: 'o site de vocês diz que abrem em breve',
  COMING_SOON: 'o site de vocês está como "em breve"',
  NEW_LOCATION: 'o site de vocês menciona uma nova unidade',
  NEW_BUSINESS: 'o site de vocês descreve o negócio como recém-aberto',
  UNDER_CONSTRUCTION_WEBSITE: 'o site de vocês ainda é uma página provisória',
  HIRING: 'vocês estão anunciando vagas',
  RECENT_REVIEWS: 'vocês receberam avaliações recentemente',
  RECENT_SOCIAL_ACTIVITY: 'vocês têm postado recentemente',
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
