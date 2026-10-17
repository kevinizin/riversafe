import type { CountryProfile } from './types.js';
import { UK_CITIES, UK_NATIONS, normalisePostcode, postcodeKey } from '../geo/uk.js';

export const UNITED_KINGDOM: CountryProfile = {
  code: 'GB',
  name: 'United Kingdom',
  currency: 'GBP',
  currencySymbol: '£',
  language: 'en-GB',
  timezone: 'Europe/London',
  companyProviders: ['companies_house'],
  regions: [...UK_NATIONS],
  cities: UK_CITIES.map((c) => c.name),
  domainSuffixes: ['.co.uk', '.uk', '.com', '.org.uk', '.ltd.uk', '.net'],
  legalSuffixes: [
    'limited', 'ltd', 'ltd.', 'plc', 'llp', 'lp', 'cic', 'cio',
    'company', 'co', 'holdings', 'group', 'uk',
  ],
  normalisePostcode,
  postcodeKey,
  privacyNotes: [
    'Company registry data is published by Companies House under the Open Government Licence.',
    'Officer records may contain personal data; only role and business contact details are stored.',
    'Processing basis for prospecting is legitimate interests (UK GDPR Art. 6(1)(f)); a balancing test is documented in PRIVACY.md.',
    'Marketing to individual subscribers is restricted by PECR; this system prepares outreach but never sends it.',
  ],
  sourceDisclosure: {
    answer:
      'Your details are on the public register at Companies House, where every UK ' +
      "company's registered contact information is published. I did not buy a list.",
    verifyUrl: 'https://find-and-update.company-information.service.gov.uk/',
    offer:
      "If you would rather not hear from me again, say so and I will delete your " +
      'record — deleted, not flagged.',
  },
  enabled: true,
};
