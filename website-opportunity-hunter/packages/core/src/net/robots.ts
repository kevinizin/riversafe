import { HttpClient } from './httpClient.js';
import { logger } from '../logging/logger.js';

/**
 * A deliberately small, strict robots.txt reader.
 *
 * Strictness is the point: when the file cannot be parsed, or the fetch fails
 * in a way that suggests the host is refusing us (401/403), we treat the path
 * as disallowed. Being wrongly cautious costs one lead; being wrongly permissive
 * costs the operator their reputation.
 */

interface RobotsRules {
  allow: string[];
  disallow: string[];
  crawlDelaySeconds?: number;
}

export interface RobotsDecision {
  allowed: boolean;
  reason: string;
  crawlDelaySeconds?: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  rules: RobotsRules | 'ALLOW_ALL' | 'DENY_ALL';
  fetchedAt: number;
}

export class RobotsChecker {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly http: HttpClient,
    private readonly userAgentToken: string,
    private readonly enabled = true,
    private readonly now: () => number = Date.now,
  ) {}

  async check(targetUrl: string): Promise<RobotsDecision> {
    if (!this.enabled) return { allowed: true, reason: 'robots checking disabled by configuration' };

    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch {
      return { allowed: false, reason: 'invalid URL' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { allowed: false, reason: `unsupported protocol ${url.protocol}` };
    }

    const entry = await this.load(url.origin);
    if (entry === 'ALLOW_ALL') return { allowed: true, reason: 'no robots.txt restrictions' };
    if (entry === 'DENY_ALL') return { allowed: false, reason: 'robots.txt could not be read; treating as disallowed' };

    const path = url.pathname + url.search;
    const bestAllow = longestMatch(entry.allow, path);
    const bestDisallow = longestMatch(entry.disallow, path);

    if (bestDisallow === null) {
      return { allowed: true, reason: 'not disallowed by robots.txt', crawlDelaySeconds: entry.crawlDelaySeconds };
    }
    // Longest matching rule wins; Allow wins ties (matching Google's behaviour).
    if (bestAllow !== null && bestAllow >= bestDisallow) {
      return { allowed: true, reason: 'explicitly allowed by robots.txt', crawlDelaySeconds: entry.crawlDelaySeconds };
    }
    return { allowed: false, reason: 'disallowed by robots.txt' };
  }

  private async load(origin: string): Promise<RobotsRules | 'ALLOW_ALL' | 'DENY_ALL'> {
    const cached = this.cache.get(origin);
    if (cached && this.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.rules;

    let rules: RobotsRules | 'ALLOW_ALL' | 'DENY_ALL';
    try {
      const res = await this.http.request({
        url: `${origin}/robots.txt`,
        timeoutMs: 8_000,
        maxBytes: 512_000,
        expectedStatuses: [404, 410, 401, 403],
      });
      if (res.status === 404 || res.status === 410) rules = 'ALLOW_ALL';
      else if (res.status === 401 || res.status === 403) rules = 'DENY_ALL';
      else rules = parseRobots(res.text, this.userAgentToken);
    } catch (err) {
      logger.debug('robots.fetch_failed', 'robots.txt unavailable; treating host as disallowed', {
        origin,
        error: err instanceof Error ? err.message : String(err),
      });
      rules = 'DENY_ALL';
    }

    this.cache.set(origin, { rules, fetchedAt: this.now() });
    return rules;
  }
}

function longestMatch(patterns: string[], path: string): number | null {
  let best: number | null = null;
  for (const pattern of patterns) {
    if (matches(pattern, path)) {
      const specificity = pattern.length;
      if (best === null || specificity > best) best = specificity;
    }
  }
  return best;
}

/** Supports the two wildcards robots.txt actually uses: `*` and a trailing `$`. */
function matches(pattern: string, path: string): boolean {
  if (pattern === '') return false;
  const anchoredEnd = pattern.endsWith('$');
  const body = anchoredEnd ? pattern.slice(0, -1) : pattern;
  const parts = body.split('*');
  let index = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part === '') continue;
    const at = i === 0 ? (path.startsWith(part) ? 0 : -1) : path.indexOf(part, index);
    if (at === -1) return false;
    index = at + part.length;
  }
  if (anchoredEnd) return index === path.length;
  return true;
}

export function parseRobots(text: string, userAgentToken: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[]; crawlDelay?: number }[] = [];
  let current: { agents: string[]; allow: string[]; disallow: string[]; crawlDelay?: number } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]!.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (!current) continue;
    lastWasAgent = false;
    if (field === 'allow') current.allow.push(value);
    else if (field === 'disallow') current.disallow.push(value);
    else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const token = userAgentToken.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific ?? wildcard;
  if (!chosen) return { allow: [], disallow: [] };
  return {
    allow: chosen.allow.filter(Boolean),
    // An empty Disallow value means "allow everything" and must not be treated
    // as a rule matching every path.
    disallow: chosen.disallow.filter((d) => d !== ''),
    ...(chosen.crawlDelay !== undefined ? { crawlDelaySeconds: chosen.crawlDelay } : {}),
  };
}
