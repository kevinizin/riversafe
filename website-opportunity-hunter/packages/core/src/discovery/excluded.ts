/**
 * Hosts that are never a company's own website.
 *
 * Directories, marketplaces, social networks and the registry itself all rank
 * highly for a company name. Accepting one as "the website" would both overstate
 * the company's digital presence and produce a nonsense analysis, so they are
 * excluded from website discovery — though social networks are still captured
 * separately as social profiles.
 */
export const EXCLUDED_WEBSITE_HOSTS = [
  // Registry and official
  'company-information.service.gov.uk', 'find-and-update.company-information.service.gov.uk',
  'gov.uk', 'companieshouse.gov.uk',
  // Company data aggregators
  'opencorporates.com', 'endole.co.uk', 'bizdb.co.uk', 'company-director-check.co.uk',
  'companiesintheuk.co.uk', 'globaldatabase.com', 'dnb.com', 'creditsafe.com',
  'companycheck.co.uk', 'ukbusinessforums.co.uk', 'bizzdirectory.co.uk',
  // Social networks
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com', 'nextdoor.co.uk',
  // Directories and marketplaces
  'yell.com', 'thomsonlocal.com', '192.com', 'cylex-uk.co.uk', 'freeindex.co.uk',
  'checkatrade.com', 'ratedpeople.com', 'mybuilder.com', 'trustatrader.com',
  'trustpilot.com', 'yelp.co.uk', 'yelp.com', 'tripadvisor.co.uk', 'tripadvisor.com',
  'bark.com', 'houzz.co.uk', 'which.co.uk', 'thebestof.co.uk', 'scoot.co.uk',
  // Sector marketplaces
  'justeat.co.uk', 'deliveroo.co.uk', 'ubereats.com', 'opentable.co.uk', 'thefork.co.uk',
  'treatwell.co.uk', 'booksy.com', 'fresha.com', 'doctify.com', 'toptutorjobs.com',
  'rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com', 'primelocation.com',
  // Hiring and generic
  'indeed.com', 'reed.co.uk', 'totaljobs.com', 'glassdoor.co.uk',
  'wikipedia.org', 'google.com', 'bing.com', 'apple.com', 'amazon.co.uk',
  'eventbrite.co.uk', 'gumtree.com', 'wordpress.com', 'blogspot.com', 'medium.com',
];

export function isExcludedHost(domain: string | null | undefined): boolean {
  if (!domain) return true;
  const host = domain.toLowerCase();
  return EXCLUDED_WEBSITE_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`));
}
