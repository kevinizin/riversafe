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
  { maxDays: YEAR_DAYS, points: 0, label: 'under a year old — too early for a system' },
  { maxDays: 2 * YEAR_DAYS, points: 14, label: '1 to 2 years — starting to feel the volume' },
  { maxDays: 5 * YEAR_DAYS, points: 20, label: '2 to 5 years — an established operation still run on improvised process' },
  { maxDays: 10 * YEAR_DAYS, points: 18, label: '5 to 10 years — high volume, and manual process is now expensive' },
];
// Beyond ten years: 14. Still a real prospect, but more likely to have bought
// something already, and replacing an entrenched tool is a longer sale.
const MATURITY_ESTABLISHED = { points: 14, label: 'over 10 years old — may already have a tool in use' };

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
      reason: `Company status is ${input.companyStatus.toLowerCase()}, so the lead is capped and ignored`,
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
    gaps.push('Industry not identified, so the fit for a system could not be assessed');
    return { component: mk(0, 'Industry not identified'), useCases: [] };
  }

  const profile = getIndustry(input.industryKey);
  if (!profile) {
    gaps.push(`Industry "${input.industryKey}" is not in the catalogue`);
    return { component: mk(0, `Industry "${input.industryKey}" unknown`), useCases: [] };
  }

  const points = Math.round(profile.systemWeight * max);
  const strength =
    profile.systemWeight >= 0.85 ? 'depends heavily on' : profile.systemWeight >= 0.6 ? 'benefits from' : 'barely needs';
  return {
    component: mk(points, `${profile.label}: a sector that ${strength} a management system`),
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
  const window = `${target.min}–${target.max} people`;
  const mk = (points: number, reason: string): SystemScoreComponent => ({
    component: 'SIZE_FIT',
    points,
    max,
    reason,
  });

  switch (fit) {
    case 'LIKELY':
      return {
        component: mk(max, `Estimated size sits inside the target range (${window})`),
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
          `Estimated size could be in the target range (${window}), but the register's own band is wider than that`,
        ),
        fit,
      };
    case 'UNLIKELY':
      return {
        component: mk(0, `Estimated size falls outside the target range (${window})`),
        fit,
      };
    default:
      // Unknown outranks known-wrong deliberately: a company we have not sized
      // is worth a look, one we have sized outside the window is not.
      gaps.push('Size unknown — no public register states a headcount');
      return { component: mk(8, 'Size unknown — worth confirming before approaching'), fit };
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
    gaps.push('Incorporation date unknown');
    return mk(0, 'Incorporation date unknown');
  }

  const ageDays = Math.floor((now.getTime() - input.incorporationDate.getTime()) / DAY_MS);
  if (ageDays < 0) return mk(0, 'Incorporation date is in the future; ignored');

  const band = MATURITY_BANDS.find((b) => ageDays <= b.maxDays);
  const years = Math.floor(ageDays / YEAR_DAYS);
  if (!band) {
    return mk(MATURITY_ESTABLISHED.points, `Incorporated ${years} years ago — ${MATURITY_ESTABLISHED.label}`);
  }
  const age = years >= 1 ? `${years} year(s) ago` : `${ageDays} day(s) ago`;
  return mk(band.points, `Incorporated ${age} — ${band.label}`);
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
  gaps.push('No public source says whether the company already runs a system internally — confirm on the call');

  if (input.noWebsiteFound) {
    return mk(
      max,
      'No website at all: no digital channel of their own, which often goes with paper or a spreadsheet (to be confirmed)',
    );
  }

  if (!input.websiteAnalysed) {
    return mk(0, 'Website not analysed — nothing observed about their digital tooling');
  }

  const passed = new Set(input.websitePassedChecks ?? []);
  // `booking` is the only check in the analyser that evidences a real
  // customer-facing system rather than a brochure page.
  const hasCustomerSystem = passed.has('booking');

  if (hasCustomerSystem) {
    return mk(
      3,
      'The site already offers online booking, so part of the operation is digitised (what runs behind it is unconfirmed)',
    );
  }

  return mk(
    12,
    'The site is brochure-only, with no client area or booking — weak evidence of manual process (to be confirmed)',
  );
}

function scoreComplexity(input: SystemScoreInput): SystemScoreComponent {
  const max = SYSTEM_COMPONENT_MAX.OPERATIONAL_COMPLEXITY;
  const parts: string[] = [];
  let points = 0;

  const profile = input.industryKey ? getIndustry(input.industryKey) : undefined;
  if (profile?.highTicket) {
    points += 3;
    parts.push('project work at a high ticket');
  }

  const locations = input.locationCount ?? 0;
  if (locations > 1) {
    points += 3;
    parts.push(`${locations} trading addresses`);
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
    reason: parts.length ? `Operational complexity: ${parts.join(', ')}` : 'No signs of a complex operation',
  };
}

function signalLabel(type: string): string {
  switch (type) {
    case 'HIRING':
      return 'hiring (the team is growing)';
    case 'NEW_LOCATION':
      return 'opened a new site';
    case 'RECENT_REVIEWS':
      return 'recent customer activity';
    case 'RECENT_SOCIAL_ACTIVITY':
      return 'recent social activity';
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
