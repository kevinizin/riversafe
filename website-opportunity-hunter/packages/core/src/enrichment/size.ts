/**
 * Company size — estimated, and labelled as estimated everywhere it appears.
 *
 * This module exists because of a gap between what is wanted and what is
 * published. The operator's target for a management system is a company with
 * roughly ten to fifteen people. Neither registry this system reads publishes
 * a headcount:
 *
 *  - The Receita Federal's CNPJ open data carries `porte`, which is a *revenue*
 *    classification from LC 123/2006 (ME up to R$ 360k/year, EPP up to
 *    R$ 4.8M/year). It says nothing directly about how many people work there.
 *  - Companies House carries the *accounts category* a company filed under.
 *    The UK thresholds do include an employee test, but a company qualifies on
 *    any two of three criteria, so a three-person consultancy with high turnover
 *    can file small-company accounts.
 *
 * So there is no honest way to answer "does this company have 10 to 15
 * employees". What there is: a band, a plausible range, the evidence it rests
 * on, and a confidence that never reaches HIGH. Every function here returns
 * `inferred: true` for that reason, and the UI must never render these numbers
 * as a headcount the registry stated.
 *
 * The employee ranges attached to Brazilian bands come from the SEBRAE
 * convention used in Brazilian statistics (micro: up to 9 people in commerce
 * and services; small: 10 to 49). That convention is a population-level
 * description, not a fact about any one company, and the wide ranges here say
 * so honestly rather than pretending to a precision the source cannot support.
 */

import type { Confidence, Evidence, Sourced } from '../domain/types.js';
import { sourced } from '../domain/types.js';

export type SizeBand = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';

/** How a size estimate lines up with the headcount the operator is looking for. */
export type SizeFit = 'LIKELY' | 'POSSIBLE' | 'UNLIKELY' | 'UNKNOWN';

export interface SizeEstimate {
  band: SizeBand;
  /**
   * The plausible headcount range for this band, inclusive. `max: undefined`
   * means open-ended. This is a statistical range for the band, never a claim
   * about this company.
   */
  employeesFrom: number;
  employeesTo?: number;
  /** Plain-language reasons, in the operator's language, shown next to the band. */
  basis: string[];
}

/** The operator's headcount target for a given search. */
export interface EmployeeTarget {
  min: number;
  max: number;
}

// --- Brazil -----------------------------------------------------------------

/**
 * `porte_empresa` in the Receita Federal "Empresas" layout.
 * 00 not stated, 01 microempresa, 03 empresa de pequeno porte, 05 everything else.
 */
export type ReceitaPorte = '00' | '01' | '03' | '05';

export const PORTE_LABEL: Record<ReceitaPorte, string> = {
  '00': 'Não informado',
  '01': 'Microempresa (ME)',
  '03': 'Empresa de pequeno porte (EPP)',
  '05': 'Demais (acima do Simples)',
};

/**
 * Capital social is weak evidence on its own: a great many Brazilian companies
 * declare a round R$ 1.000 and never update it, and the figure is not audited.
 * It is used here only to narrow a band the `porte` already established, never
 * to set one.
 */
const CAPITAL_SUGGESTS_STAFFED = 100_000;
const CAPITAL_SUGGESTS_MINIMAL = 5_000;

/**
 * Size from the Receita Federal fields.
 *
 * `porte` drives the band. `capitalSocial` can lift or lower the confidence and
 * narrow the range inside the band, because a company on the EPP revenue
 * ceiling with six figures of declared capital is a different proposition from
 * one with R$ 1.000 — but it never overrides the band, and a missing or zero
 * capital is simply no evidence rather than evidence of smallness.
 */
export function estimateSizeFromPorte(
  porte: ReceitaPorte | string | undefined,
  capitalSocial: number | undefined,
  evidence: Evidence,
): Sourced<SizeEstimate> | undefined {
  const code = normalisePorte(porte);
  if (!code || code === '00') return undefined;

  const capital = typeof capitalSocial === 'number' && capitalSocial > 0 ? capitalSocial : undefined;
  const basis: string[] = [`Porte declarado na Receita Federal: ${PORTE_LABEL[code]}`];

  let band: SizeBand;
  let employeesFrom: number;
  let employeesTo: number | undefined;
  let confidence: Confidence;

  if (code === '01') {
    // ME is a revenue ceiling of R$ 360k/year. By the SEBRAE convention that is
    // the micro band: up to nine people in commerce and services.
    band = 'MICRO';
    employeesFrom = 1;
    employeesTo = 9;
    confidence = 'MEDIUM';
    basis.push('Faturamento até R$ 360 mil/ano (LC 123/2006) — porte micro');
  } else if (code === '03') {
    // EPP is the band the ten-to-fifteen target lives in, and it is wide:
    // R$ 360k to R$ 4.8M of annual revenue covers a two-person agency and a
    // forty-person builder alike.
    band = 'SMALL';
    employeesFrom = 10;
    employeesTo = 49;
    confidence = 'MEDIUM';
    basis.push('Faturamento entre R$ 360 mil e R$ 4,8 milhões/ano (LC 123/2006)');
  } else {
    // "Demais" means only "above the Simples Nacional ceiling". It covers a
    // fifty-person firm and a multinational subsidiary, so the range stays open
    // and the confidence drops.
    band = 'MEDIUM';
    employeesFrom = 20;
    employeesTo = undefined;
    confidence = 'LOW';
    basis.push('Acima do teto do Simples Nacional — faixa ampla, sem teto conhecido');
  }

  if (capital !== undefined) {
    basis.push(`Capital social declarado: ${formatBrl(capital)}`);
    if (capital >= CAPITAL_SUGGESTS_STAFFED && band !== 'MICRO') {
      // Agrees with the band and adds something: raise the floor, not the band.
      employeesFrom = Math.max(employeesFrom, 10);
      confidence = 'MEDIUM';
      basis.push('Capital compatível com uma operação com equipe própria');
    } else if (capital <= CAPITAL_SUGGESTS_MINIMAL) {
      confidence = 'LOW';
      basis.push('Capital simbólico — comum em empresas sem estrutura, mas também nunca atualizado em muitas');
    }
  } else {
    basis.push('Capital social não informado');
  }

  basis.push('Nenhum registro público informa número de funcionários — esta é uma estimativa');

  return sourced({ band, employeesFrom, employeesTo, basis }, confidence, evidence, true);
}

function normalisePorte(value: string | undefined): ReceitaPorte | undefined {
  if (!value) return undefined;
  const digits = value.trim().padStart(2, '0');
  return digits === '00' || digits === '01' || digits === '03' || digits === '05'
    ? (digits as ReceitaPorte)
    : undefined;
}

function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- United Kingdom ---------------------------------------------------------

/**
 * Size from the accounts category a UK company last filed under.
 *
 * Only the categories that carry a size meaning are mapped. The rest —
 * `dormant`, `initial`, `interim`, `group`, `null`, `no-accounts-filed` — say
 * something about the filing, not about the company, and return undefined so
 * the caller records "unknown" instead of guessing.
 */
export function estimateSizeFromAccounts(
  accountsType: string | undefined,
  evidence: Evidence,
): Sourced<SizeEstimate> | undefined {
  if (!accountsType) return undefined;

  const type = accountsType.trim().toLowerCase();
  const note = 'Companies House publishes an accounts category, never a headcount — this is an estimate';

  switch (type) {
    case 'micro-entity':
      return sourced(
        {
          band: 'MICRO',
          employeesFrom: 1,
          employeesTo: 10,
          basis: ['Last accounts filed as micro-entity', 'Micro-entity thresholds include 10 employees or fewer', note],
        },
        'MEDIUM',
        evidence,
        true,
      );
    case 'small':
    case 'total-exemption-small':
    case 'partial-exemption':
      return sourced(
        {
          band: 'SMALL',
          employeesFrom: 5,
          employeesTo: 50,
          basis: [
            `Last accounts filed as ${type}`,
            'Small-company thresholds cap at 50 employees, but qualify on any two of three tests, so headcount may be far lower',
            note,
          ],
        },
        'MEDIUM',
        evidence,
        true,
      );
    case 'medium':
      return sourced(
        {
          band: 'MEDIUM',
          employeesFrom: 50,
          employeesTo: 250,
          basis: ['Last accounts filed as medium', note],
        },
        'MEDIUM',
        evidence,
        true,
      );
    case 'full':
    case 'audited-abridged':
      return sourced(
        {
          band: 'LARGE',
          employeesFrom: 50,
          basis: [`Last accounts filed as ${type}`, 'Above the small-company regime', note],
        },
        'LOW',
        evidence,
        true,
      );
    default:
      return undefined;
  }
}

// --- Matching the operator's target -----------------------------------------

/**
 * Whether an estimated size could be the headcount the operator wants.
 *
 * Deliberately generous in the middle: the question this answers is "is it
 * worth a look", and an estimate built on a revenue band cannot support a
 * yes/no. A company is only UNLIKELY when its whole plausible range sits clear
 * of the target — that is the one thing the evidence can actually rule out.
 */
export function fitsEmployeeTarget(
  estimate: SizeEstimate | undefined,
  target: EmployeeTarget,
): SizeFit {
  if (!estimate) return 'UNKNOWN';

  const from = estimate.employeesFrom;
  const to = estimate.employeesTo ?? Number.POSITIVE_INFINITY;

  // No overlap at all: the only confident negative available.
  if (to < target.min || from > target.max) return 'UNLIKELY';

  // The band sits entirely inside the target. As close to a yes as this gets,
  // and still not a fact: LIKELY means "the evidence points here", not "it is so".
  if (from >= target.min && to <= target.max) return 'LIKELY';

  return 'POSSIBLE';
}

/** One line for a lead card, honest about being an estimate. */
export function describeSize(estimate: SizeEstimate | undefined): string {
  if (!estimate) return 'Porte desconhecido';
  const range =
    estimate.employeesTo === undefined
      ? `${estimate.employeesFrom}+ pessoas`
      : `${estimate.employeesFrom}–${estimate.employeesTo} pessoas`;
  return `${BAND_LABEL[estimate.band]} · estimativa ${range}`;
}

export const BAND_LABEL: Record<SizeBand, string> = {
  MICRO: 'Micro',
  SMALL: 'Pequena',
  MEDIUM: 'Média',
  LARGE: 'Grande',
};

/**
 * The target the operator described: a team big enough to have process pain,
 * small enough to still buy from one conversation.
 */
export const DEFAULT_SYSTEM_TARGET: EmployeeTarget = { min: 10, max: 15 };
