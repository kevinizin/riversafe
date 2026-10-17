import type { Confidence, DiscoveryMethod, SocialPlatform } from '../domain/types.js';
import { describeError } from '../domain/errors.js';
import { normaliseCompanyName } from '../dedup/normalize.js';
import type { PageFacts } from '../analyzer/extract.js';
import type { PlaceProvider, PlaceRecord } from '../providers/places/types.js';
import type { WebSearchProvider } from '../providers/search/types.js';

export interface DiscoveredSocialProfile {
  platform: SocialPlatform;
  url: string;
  handle?: string;
  method: DiscoveryMethod;
  confidence: Confidence;
  evidence: string;
}

export interface SocialDiscoveryResult {
  profiles: DiscoveredSocialProfile[];
  attempts: { method: string; outcome: string; note: string }[];
}

export interface SocialDiscoveryInput {
  companyName: string;
  city?: string | undefined;
  legalSuffixes: string[];
  /** Facts from the company's own website, when one was found and analysed. */
  websiteFacts?: PageFacts | undefined;
  place?: PlaceRecord | null | undefined;
  /** Platforms worth a dedicated search query. */
  searchPlatforms?: SocialPlatform[];
}

export interface SocialDiscoveryDeps {
  webSearch: WebSearchProvider;
  places?: PlaceProvider;
}

const PLATFORM_HOSTS: Record<string, SocialPlatform> = {
  'instagram.com': 'INSTAGRAM',
  'facebook.com': 'FACEBOOK',
  'fb.com': 'FACEBOOK',
  'linkedin.com': 'LINKEDIN',
  'twitter.com': 'X',
  'x.com': 'X',
  'tiktok.com': 'TIKTOK',
  'youtube.com': 'YOUTUBE',
};

const PLATFORM_SEARCH_SITE: Partial<Record<SocialPlatform, string>> = {
  INSTAGRAM: 'instagram.com',
  FACEBOOK: 'facebook.com',
  LINKEDIN: 'linkedin.com',
};

/**
 * Finds public social profiles without touching any platform's private surface.
 *
 * Two permitted routes only: links the company publishes on its own website,
 * and public web-search results. Nothing here logs into a platform, scrapes a
 * feed, or estimates follower counts or posting frequency — the system records
 * that a profile exists, and says so, rather than inventing engagement data.
 */
export async function discoverSocialProfiles(
  input: SocialDiscoveryInput,
  deps: SocialDiscoveryDeps,
): Promise<SocialDiscoveryResult> {
  const profiles: DiscoveredSocialProfile[] = [];
  const attempts: SocialDiscoveryResult['attempts'] = [];
  const seen = new Set<string>();

  const add = (profile: DiscoveredSocialProfile): void => {
    const key = `${profile.platform}:${profile.url.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    profiles.push(profile);
  };

  if (input.websiteFacts) {
    for (const link of input.websiteFacts.socialLinks) {
      add({
        platform: link.platform,
        url: link.url,
        ...(handleFrom(link.url) ? { handle: handleFrom(link.url)! } : {}),
        method: 'WEBSITE_LINK',
        confidence: 'HIGH',
        evidence: `linked from the company's own website (${input.websiteFacts.domain ?? 'homepage'})`,
      });
    }
    attempts.push({
      method: 'WEBSITE_LINK',
      outcome: input.websiteFacts.socialLinks.length ? 'FOUND' : 'NO_RESULTS',
      note: `${input.websiteFacts.socialLinks.length} social link(s) on the homepage`,
    });
  } else {
    attempts.push({ method: 'WEBSITE_LINK', outcome: 'SKIPPED', note: 'no website was analysed' });
  }

  if (input.place?.mapsUri) {
    add({
      platform: 'GOOGLE_BUSINESS',
      url: input.place.mapsUri,
      method: 'PLACES_PROVIDER',
      confidence: 'HIGH',
      evidence: `business listing matched "${input.place.displayName ?? input.companyName}"`,
    });
  }

  const platforms = input.searchPlatforms ?? (['INSTAGRAM', 'FACEBOOK'] as SocialPlatform[]);
  const normalisedName = normaliseCompanyName(input.companyName, input.legalSuffixes);
  const nameTokens = normalisedName.split(' ').filter((t) => t.length >= 3);

  for (const platform of platforms) {
    if (profiles.some((p) => p.platform === platform)) continue;
    const site = PLATFORM_SEARCH_SITE[platform];
    if (!site) continue;
    const query = `site:${site} "${input.companyName}"${input.city ? ` ${input.city}` : ''}`;
    try {
      const results = await deps.webSearch.search(query, { count: 5, countryCode: 'GB' });
      const hit = results.find((r) => {
        const host = hostOf(r.url);
        if (!host || PLATFORM_HOSTS[host] !== platform) return false;
        // Require the profile page itself to echo the company's name tokens, so
        // a passing mention in someone else's post is not mistaken for a profile.
        const haystack = `${r.title} ${r.snippet} ${r.url}`.toLowerCase();
        return nameTokens.length > 0 && nameTokens.every((t) => haystack.includes(t));
      });
      if (hit) {
        add({
          platform,
          url: hit.url,
          ...(handleFrom(hit.url) ? { handle: handleFrom(hit.url)! } : {}),
          method: 'WEB_SEARCH_NAME_LOCATION',
          confidence: 'MEDIUM',
          evidence: `public search result whose title and URL contain "${nameTokens.join(' ')}"`,
        });
      }
      attempts.push({
        method: `SEARCH_${platform}`,
        outcome: hit ? 'FOUND' : 'NO_RESULTS',
        note: hit ? hit.url : `${results.length} result(s), none matched the company name`,
      });
    } catch (err) {
      const { code, message } = describeError(err);
      attempts.push({
        method: `SEARCH_${platform}`,
        outcome: code === 'PROVIDER_NOT_CONFIGURED' ? 'SKIPPED' : 'UNAVAILABLE',
        note: message,
      });
    }
  }

  return { profiles, attempts };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function handleFrom(url: string): string | null {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean);
    const first = path[0];
    if (!first || ['p', 'posts', 'pages', 'company', 'watch', 'reel'].includes(first)) {
      return path[1] ? `@${path[1]}` : null;
    }
    return `@${first}`;
  } catch {
    return null;
  }
}
