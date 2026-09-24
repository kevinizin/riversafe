/**
 * The System Opportunity Score — the second axis.
 *
 * The website axis asks "is this a good moment to sell them a website". It
 * rewards youth: a company two weeks old has no site and knows it. This axis
 * asks a different question with an almost opposite answer — "is this a good
 * moment to sell them a management system" — and a two-week-old company is the
 * worst possible answer to it. It has no orders to track, no staff to schedule
 * and no process pain, because it has barely started trading.
 *
 * So the two axes are scored separately and never averaged. A company can be
 * HOT on one and IGNORE on the other, and that is the useful outcome: it tells
 * the operator which conversation to open, not merely how warm the lead is.
 *
 * What this axis can and cannot see:
 *
 *   It can see the sector (what the work is made of), an estimated size band,
 *   the age of the company, and whether the public website offers any
 *   customer-facing system at all.
 *
 *   It cannot see whether the company already runs a system internally. No
 *   public source publishes that. The SYSTEM_GAP component below is therefore
 *   written narrowly, about the public website only, and its reason text says
 *   so — because a component that quietly implied "they have no ERP" would be
 *   exactly the kind of invented fact this project forbids.
 */

import type { BusinessActivitySignal, CompanyStatus, Confidence, Classification } from '../domain/types.js';
import { getIndustry } from '../industry/taxonomy.js';
import { DEFAULT_SYSTEM_TARGET, fitsEmployeeTarget, type EmployeeTarget, type SizeEstimate, type SizeFit } from '../enrichment/size.js';
import {
  DEFAULT_THRESHOLDS,
  type ClassificationThresholds,
  classifyScore,
} from './config.js';
import type { ScoreComponent } from './opportunity.js';

/** Maximum points each system component may contribute. They sum to 100. */
export const SYSTEM_COMPONENT_MAX = {
  SECTOR_FIT: 30,
  SIZE_FIT: 25,
  MATURITY: 20,
  SYSTEM_GAP: 15,
  OPERATIONAL_COMPLEXITY: 10,
} as const;

export type SystemComponentKey = keyof typeof SYSTEM_COMPONENT_MAX;

export interface SystemScoreComponent extends Omit<ScoreComponent, 'component'> {
  component: SystemComponentKey;
}

export interface SystemOpportunityScore {
  score: number;
  classification: Classification;
  confidence: Confidence;
  reasons: string[];
  components: SystemScoreComponent[];
  gaps: string[];
  /** How the size estimate lined up with the target, surfaced for filtering. */
  sizeFit: SizeFit;
  /** What a system would run for this sector, taken from the industry profile. */
  useCases: string[];
}

export interface SystemScoreInput {
  now?: Date;
  companyStatus: CompanyStatus;
  incorporationDate?: Date | null | undefined;

  industryKey?: string | null | undefined;
  industryConfidence?: Confidence | null | undefined;

  /** From the porte/accounts estimate. Undefined means unknown, not small. */
  sizeEstimate?: SizeEstimate | null | undefined;
  /** Defaults to the operator's 10–15 target. */
  employeeTarget?: EmployeeTarget;

  /** Keys of the quality checks the public website passed, when one was analysed. */
  websitePassedChecks?: string[];
  /** True when website discovery concluded there is no website at all. */
  noWebsiteFound?: boolean;
  /** True when a website exists and was analysed. Distinguishes "no system on
   *  the site" from "we never looked at a site". */
  websiteAnalysed?: boolean;

  signals?: BusinessActivitySignal[];
  /** Locations the company is known to trade from, when established. */
  locationCount?: number | null | undefined;

  thresholds?: ClassificationThresholds;
}

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;

/** Age bands for the system axis, youngest first. The mirror image of RECENCY. */
const MATURITY_BANDS: { maxDays: number; points: number; label: string }[] = [
  // Below a year there is nothing to organise yet. Scored zero on purpose:
  // these companies are the website axis's business, not this one's.
  { maxDays: YEAR_DAYS, points: 0, label: 'menos de 1 ano — cedo demais para um sistema' },
  { maxDays: 2 * YEAR_DAYS, points: 14, label: '1 a 2 anos — começando a sentir o volume' },
  { maxDays: 5 * YEAR_DAYS, points: 20, label: '2 a 5 anos — operação consolidada, processo ainda improvisado' },
  { maxDays: 10 * YEAR_DAYS, points: 18, label: '5 a 10 anos — volume alto e processo manual custa caro' },
];
// Beyond ten years: 14. Still a real prospect, but more likely to have bought
// something already, and replacing an entrenched tool is a longer sale.
const MATURITY_ESTABLISHED = { points: 14, label: 'mais de 10 anos — pode já ter uma ferramenta em uso' };

/** Signals that suggest an operation under load rather than a quiet one. */
const COMPLEXITY_SIGNAL_POINTS: Record<string, number> = {
  HIRING: 4,
  NEW_LOCATION: 3,
  RECENT_REVIEWS: 1,
  RECENT_SOCIAL_ACTIVITY: 1,
};

/**
 * Scores the system opportunity 0–100.
 *
 * Same contract as the website axis: every point traces to a named component
 * with a sentence the operator can read on a call, unknowns land in `gaps`
 * rather than being scored as zeroes with no explanation, and a company that is
 * not trading is capped and ignored whatever else it looks like.
 */
export function calculateSystemScore(input: SystemScoreInput): SystemOpportunityScore {
  const now = input.now ?? new Date();
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const target = input.employeeTarget ?? DEFAULT_SYSTEM_TARGET;
  const gaps: string[] = [];
  const components: SystemScoreComponent[] = [];

  const sector = scoreSectorFit(input, gaps);
  components.push(sector.component);

  const size = scoreSizeFit(input, target, gaps);
  components.push(size.component);

  components.push(scoreMaturity(input, now, gaps));
  components.push(scoreSystemGap(input, gaps));
  components.push(scoreComplexity(input));

  let total = components.reduce((sum, c) => sum + c.points, 0);
  total = Math.max(0, Math.min(100, Math.round(total)));

  const inactive = input.companyStatus !== 'ACTIVE' && input.companyStatus !== 'UNKNOWN';
  let classification: Classification;
  if (inactive) {
    total = Math.min(total, 20);
    classification = 'IGNORE';
    components.push({
      component: 'OPERATIONAL_COMPLEXITY',
      points: 0,
      max: 0,
      reason: `Situação cadastral: ${input.companyStatus.toLowerCase()} — lead descartado`,
    });
  } else {
    classification = classifyScore(total, thresholds);
  }

  const reasons = components
    .filter((c) => c.max > 0)
    .sort((a, b) => b.points - a.points)
    .map((c) => `${c.points > 0 ? '+' : ''}${c.points} ${c.reason}`);

  return {
    score: total,
    classification,
    confidence: systemConfidence(input, gaps),
    reasons,
    components,
    gaps,
    sizeFit: size.fit,
    useCases: sector.useCases,
  };
}

function scoreSectorFit(
  input: SystemScoreInput,
  gaps: string[],
): { component: SystemScoreComponent; useCases: string[] } {
  const max = SYSTEM_COMPONENT_MAX.SECTOR_FIT;
  const mk = (points: number, reason: string): SystemScoreComponent => ({
    component: 'SECTOR_FIT',
    points,
    max,
    reason,
  });

  if (!input.industryKey) {
    // Same rule as the website axis: an unidentified sector scores nothing and
    // is recorded as a gap, rather than being given an average weight that
    // would be a number we made up.
    gaps.push('Setor não identificado — o encaixe com um sistema não pôde ser avaliado');
    return { component: mk(0, 'Setor não identificado'), useCases: [] };
  }

  const profile = getIndustry(input.industryKey);
  if (!profile) {
    gaps.push(`Setor "${input.industryKey}" não está no catálogo`);
    return { component: mk(0, `Setor "${input.industryKey}" desconhecido`), useCases: [] };
  }

  const points = Math.round(profile.systemWeight * max);
  const strength =
    profile.systemWeight >= 0.85 ? 'depende fortemente' : profile.systemWeight >= 0.6 ? 'se beneficia' : 'depende pouco';
  return {
    component: mk(points, `${profile.label}: setor que ${strength} de um sistema de gestão`),
    useCases: profile.systemUseCases,
  };
}

function scoreSizeFit(
  input: SystemScoreInput,
  target: EmployeeTarget,
  gaps: string[],
): { component: SystemScoreComponent; fit: SizeFit } {
  const max = SYSTEM_COMPONENT_MAX.SIZE_FIT;
  const estimate = input.sizeEstimate ?? undefined;
  const fit = fitsEmployeeTarget(estimate, target);
  const window = `${target.min}–${target.max} pessoas`;
  const mk = (points: number, reason: string): SystemScoreComponent => ({
    component: 'SIZE_FIT',
    points,
    max,
    reason,
  });

  switch (fit) {
    case 'LIKELY':
      return {
        component: mk(max, `Porte estimado dentro da faixa alvo (${window})`),
        fit,
      };
    case 'POSSIBLE':
      // The common case for Brazil: EPP spans 10–49 by the SEBRAE convention,
      // so it overlaps the target without confirming it. Nearly all the points,
      // because overlap is the best the open data can offer — and a top band
      // that the best available evidence can never reach is a band that does
      // not exist. The doubt is carried by `confidence`, which this axis caps
      // at MEDIUM for exactly this reason, not by points shaved off the
      // component. (Same reasoning as NO_WEBSITE_FOUND on the website axis.)
      return {
        component: mk(
          20,
          `Porte estimado pode estar na faixa alvo (${window}), mas a faixa do registro é mais larga que isso`,
        ),
        fit,
      };
    case 'UNLIKELY':
      return {
        component: mk(0, `Porte estimado fora da faixa alvo (${window})`),
        fit,
      };
    default:
      // Unknown outranks known-wrong deliberately: a company we have not sized
      // is worth a look, one we have sized outside the window is not.
      gaps.push('Porte desconhecido — nenhum registro público informa número de funcionários');
      return { component: mk(8, 'Porte desconhecido — vale confirmar antes de abordar'), fit };
  }
}

function scoreMaturity(input: SystemScoreInput, now: Date, gaps: string[]): SystemScoreComponent {
  const max = SYSTEM_COMPONENT_MAX.MATURITY;
  const mk = (points: number, reason: string): SystemScoreComponent => ({
    component: 'MATURITY',
    points,
    max,
    reason,
  });

  if (!input.incorporationDate) {
    gaps.push('Data de abertura desconhecida');
    return mk(0, 'Data de abertura desconhecida');
  }

  const ageDays = Math.floor((now.getTime() - input.incorporationDate.getTime()) / DAY_MS);
  if (ageDays < 0) return mk(0, 'Data de abertura no futuro — ignorada');

  const band = MATURITY_BANDS.find((b) => ageDays <= b.maxDays);
  const years = Math.floor(ageDays / YEAR_DAYS);
  if (!band) {
    return mk(MATURITY_ESTABLISHED.points, `Aberta há ${years} anos — ${MATURITY_ESTABLISHED.label}`);
  }
  const age = years >= 1 ? `há ${years} ano(s)` : `há ${ageDays} dia(s)`;
  return mk(band.points, `Aberta ${age} — ${band.label}`);
}

function scoreSystemGap(input: SystemScoreInput, gaps: string[]): SystemScoreComponent {
  const max = SYSTEM_COMPONENT_MAX.SYSTEM_GAP;
  const mk = (points: number, reason: string): SystemScoreComponent => ({
    component: 'SYSTEM_GAP',
    points,
    max,
    reason,
  });

  // The honesty boundary of this whole module. What follows reasons only about
  // the public website. Whether the company runs something internally is not
  // published anywhere, so it is recorded as a gap on every path — including
  // the path that awards full points.
  gaps.push('Nenhuma fonte pública informa se a empresa já usa um sistema interno — confirmar na conversa');

  if (input.noWebsiteFound) {
    return mk(
      max,
      'Sem site: nenhum canal digital próprio, o que costuma acompanhar controle em papel ou planilha (a confirmar)',
    );
  }

  if (!input.websiteAnalysed) {
    return mk(0, 'Site não analisado — nada observado sobre ferramentas digitais');
  }

  const passed = new Set(input.websitePassedChecks ?? []);
  // `booking` is the only check in the analyser that evidences a real
  // customer-facing system rather than a brochure page.
  const hasCustomerSystem = passed.has('booking');

  if (hasCustomerSystem) {
    return mk(
      3,
      'O site já oferece agendamento on-line — parte da operação está digitalizada (a confirmar o que roda por trás)',
    );
  }

  return mk(
    12,
    'O site é apenas institucional, sem área de cliente ou agendamento — indício fraco de processo manual (a confirmar)',
  );
}

function scoreComplexity(input: SystemScoreInput): SystemScoreComponent {
  const max = SYSTEM_COMPONENT_MAX.OPERATIONAL_COMPLEXITY;
  const parts: string[] = [];
  let points = 0;

  const profile = input.industryKey ? getIndustry(input.industryKey) : undefined;
  if (profile?.highTicket) {
    points += 3;
    parts.push('trabalho por projeto e ticket alto');
  }

  const locations = input.locationCount ?? 0;
  if (locations > 1) {
    points += 3;
    parts.push(`${locations} endereços de operação`);
  }

  const seen = new Set<string>();
  for (const signal of input.signals ?? []) {
    if (seen.has(signal.type)) continue;
    const value = COMPLEXITY_SIGNAL_POINTS[signal.type];
    if (value === undefined) continue;
    seen.add(signal.type);
    points += value;
    parts.push(signalLabel(signal.type));
  }

  points = Math.min(points, max);
  return {
    component: 'OPERATIONAL_COMPLEXITY',
    points,
    max,
    reason: parts.length ? `Complexidade operacional: ${parts.join(', ')}` : 'Sem indícios de operação complexa',
  };
}

function signalLabel(type: string): string {
  switch (type) {
    case 'HIRING':
      return 'contratando (equipe crescendo)';
    case 'NEW_LOCATION':
      return 'abriu nova unidade';
    case 'RECENT_REVIEWS':
      return 'movimento recente de clientes';
    case 'RECENT_SOCIAL_ACTIVITY':
      return 'atividade recente nas redes';
    default:
      return type.toLowerCase();
  }
}

/**
 * Confidence in the score, not in the sale.
 *
 * Capped at MEDIUM whenever the size rests on an estimate, which for this axis
 * is always: the size component is the second-heaviest, and it is built on a
 * revenue band. Claiming HIGH would be claiming to know a headcount.
 */
function systemConfidence(input: SystemScoreInput, gaps: string[]): Confidence {
  if (gaps.length >= 3) return 'LOW';
  if (!input.industryKey || input.industryConfidence === 'LOW') return 'LOW';
  if (!input.sizeEstimate || !input.incorporationDate) return 'LOW';
  return 'MEDIUM';
}
