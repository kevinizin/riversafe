import type { OfficerRecord } from '../providers/companies/types.js';

/**
 * Picking the person to address.
 *
 * The registry publishes every officer; only some of them are plausibly the
 * person who decides whether to buy a website. A secretary or a corporate
 * director is not that person, and a resigned one certainly is not.
 */

/** Roles that plausibly make a buying decision, best first. */
const DECISION_ROLES: { role: string; label: string; rank: number }[] = [
  { role: 'llp-designated-member', label: 'Designated member', rank: 0 },
  { role: 'director', label: 'Director', rank: 1 },
  { role: 'llp-member', label: 'Member', rank: 2 },
  { role: 'member-of-a-management-body', label: 'Management body member', rank: 3 },
  { role: 'managing-officer', label: 'Managing officer', rank: 4 },
  { role: 'judicial-factor', label: 'Judicial factor', rank: 8 },
  { role: 'secretary', label: 'Company secretary', rank: 9 },
];

export interface DecisionMaker {
  officer: OfficerRecord;
  roleLabel: string;
  /** Why this officer was chosen, shown next to the contact in the UI. */
  reason: string;
  /** True when this looks like a founder: appointed at or near incorporation. */
  likelyFounder: boolean;
}

export interface SelectionResult {
  best?: DecisionMaker;
  others: DecisionMaker[];
  /** Active, person (non-corporate) officers in decision-making roles. */
  activeDecisionMakers: number;
  /** Set when nothing usable was found, explaining why. */
  note?: string;
}

export function roleLabel(role: string): string {
  const known = DECISION_ROLES.find((r) => r.role === role);
  if (known) return known.label;
  return role.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const FOUNDER_WINDOW_DAYS = 14;

/**
 * Ranks officers and picks the one to address.
 *
 * Preference order: role seniority, then earliest appointment — the first
 * director of a young company is usually its founder, which is exactly who
 * decides on a website. Corporate officers and resigned appointments are
 * excluded outright rather than ranked low.
 */
export function selectDecisionMaker(
  officers: OfficerRecord[],
  incorporationDate?: Date | null,
): SelectionResult {
  const usable = officers.filter((o) => o.isActive && !o.isCorporate);
  if (usable.length === 0) {
    const why =
      officers.length === 0
        ? 'the registry lists no officers'
        : officers.every((o) => o.isCorporate)
          ? 'every listed officer is another company, not a person'
          : 'every listed appointment has been resigned';
    return { others: [], activeDecisionMakers: 0, note: `No individual decision maker found: ${why}.` };
  }

  const ranked = usable
    .map((officer) => {
      const known = DECISION_ROLES.find((r) => r.role === officer.role);
      const rank = known?.rank ?? 6;
      const likelyFounder =
        !!incorporationDate &&
        !!officer.appointedOn &&
        Math.abs(officer.appointedOn.getTime() - incorporationDate.getTime()) <=
          FOUNDER_WINDOW_DAYS * 86_400_000;
      return { officer, rank, likelyFounder };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const aAt = a.officer.appointedOn?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bAt = b.officer.appointedOn?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aAt - bAt;
    });

  const decisionMakers = ranked.map(({ officer, likelyFounder }): DecisionMaker => {
    const label = roleLabel(officer.role);
    const parts = [`${label} on the public register`];
    if (likelyFounder) parts.push('appointed at incorporation, so likely a founder');
    else if (officer.appointedOn) parts.push(`appointed ${officer.appointedOn.toISOString().slice(0, 10)}`);
    if (officer.occupation) parts.push(`occupation given as "${officer.occupation}"`);
    return { officer, roleLabel: label, reason: parts.join('; '), likelyFounder };
  });

  const soleTrader = decisionMakers.length === 1;
  const best = decisionMakers[0]!;
  if (soleTrader) best.reason += '; the only active officer, so almost certainly the decision maker';

  return {
    best,
    others: decisionMakers.slice(1),
    activeDecisionMakers: decisionMakers.length,
  };
}

/**
 * A greeting for an outreach draft.
 *
 * Companies House renders names as "SURNAME, Forename". A message that opens
 * "Hi DEMO, Alex" reads like a mail merge that went wrong, so the parts are
 * reordered — and when no name was collected the result is null and the draft
 * falls back to a neutral greeting rather than guessing.
 */
export function greetingName(officerName: string | null | undefined): string | null {
  if (!officerName) return null;
  const trimmed = officerName.trim();
  if (!trimmed) return null;

  const [surnamePart, forenamePart] = trimmed.split(',', 2);
  const forenames = (forenamePart ?? '').trim();
  if (forenames) {
    const first = forenames.split(/\s+/)[0]!;
    return titleCase(first);
  }

  // No comma: assume "Forename Surname" and take the first word.
  const first = trimmed.split(/\s+/)[0] ?? '';
  return first ? titleCase(first) : titleCase(surnamePart ?? '');
}

function titleCase(value: string): string {
  const clean = value.replace(/[^\p{L}\p{M}'-]/gu, '');
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}
