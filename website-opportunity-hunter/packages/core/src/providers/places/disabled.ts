import { AppError } from '../../domain/errors.js';
import type { PlaceProvider, PlaceRecord } from './types.js';

export class DisabledPlaceProvider implements PlaceProvider {
  readonly name = 'disabled';
  isConfigured(): boolean {
    return false;
  }
  async findPlace(): Promise<PlaceRecord | null> {
    throw new AppError(
      'PROVIDER_NOT_CONFIGURED',
      'No places provider is configured. Review counts, ratings and opening hours will stay UNKNOWN.',
    );
  }
}
