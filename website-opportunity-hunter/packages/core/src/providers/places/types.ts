export interface PlaceRecord {
  providerPlaceId: string;
  displayName?: string;
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  /** Weekly opening hours as the provider formats them. Stored verbatim. */
  openingHours?: string[];
  mapsUri?: string;
}

export interface PlaceQuery {
  name: string;
  address?: string;
  city?: string;
  countryCode?: string;
}

/** A business-listing source: ratings, review counts, opening hours, website. */
export interface PlaceProvider {
  readonly name: string;
  isConfigured(): boolean;
  findPlace(query: PlaceQuery): Promise<PlaceRecord | null>;
}
