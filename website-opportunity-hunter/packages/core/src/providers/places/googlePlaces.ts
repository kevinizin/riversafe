import { AppError } from '../../domain/errors.js';
import { HttpClient, type HttpClientOptions } from '../../net/httpClient.js';
import { getRateLimiter } from '../../net/rateLimiter.js';
import type { PlaceProvider, PlaceQuery, PlaceRecord } from './types.js';

/**
 * Google Places API (New) Text Search.
 *   POST https://places.googleapis.com/v1/places:searchText
 *   Headers: X-Goog-Api-Key, X-Goog-FieldMask
 *
 * The field mask is deliberately narrow — Places is billed per requested field
 * set, so asking for less costs less.
 */
interface PlacesResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    rating?: number;
    userRatingCount?: number;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    googleMapsUri?: string;
  }[];
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.googleMapsUri',
].join(',');

const PROVIDER = 'google_places';

export class GooglePlacesProvider implements PlaceProvider {
  readonly name = PROVIDER;
  private readonly http: HttpClient;

  constructor(
    private readonly apiKey: string,
    opts: { fetchImpl?: typeof fetch; onCall?: HttpClientOptions['onCall'] } = {},
  ) {
    this.http = new HttpClient({
      name: PROVIDER,
      rateLimiter: getRateLimiter(PROVIDER, 60, 60_000),
      maxRetries: 2,
      defaultTimeoutMs: 10_000,
      defaultMaxBytes: 1_000_000,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.onCall ? { onCall: opts.onCall } : {}),
    });
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async findPlace(query: PlaceQuery): Promise<PlaceRecord | null> {
    if (!this.isConfigured()) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', 'Google Places API key is not set');
    }
    const textQuery = [query.name, query.address, query.city].filter(Boolean).join(', ');
    const res = await this.http.request({
      url: 'https://places.googleapis.com/v1/places:searchText',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
        'x-goog-fieldmask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 1,
        ...(query.countryCode ? { regionCode: query.countryCode.toUpperCase() } : {}),
      }),
    });

    let body: PlacesResponse;
    try {
      body = JSON.parse(res.text) as PlacesResponse;
    } catch (err) {
      throw new AppError('INVALID_RESPONSE', 'google_places returned non-JSON', { cause: err });
    }

    const place = body.places?.[0];
    if (!place?.id) return null;
    return {
      providerPlaceId: place.id,
      ...(place.displayName?.text ? { displayName: place.displayName.text } : {}),
      ...(place.formattedAddress ? { formattedAddress: place.formattedAddress } : {}),
      ...(place.websiteUri ? { websiteUri: place.websiteUri } : {}),
      ...(place.nationalPhoneNumber ? { nationalPhoneNumber: place.nationalPhoneNumber } : {}),
      ...(typeof place.rating === 'number' ? { rating: place.rating } : {}),
      ...(typeof place.userRatingCount === 'number' ? { userRatingCount: place.userRatingCount } : {}),
      ...(place.regularOpeningHours?.weekdayDescriptions
        ? { openingHours: place.regularOpeningHours.weekdayDescriptions }
        : {}),
      ...(place.googleMapsUri ? { mapsUri: place.googleMapsUri } : {}),
    };
  }
}
