import { z } from 'zod';

export const SETTINGS_KEY = 'search_defaults';

export const settingsSchema = z.object({
  countryCode: z.string().length(2).default('GB'),
  defaultIndustryKeys: z.array(z.string()).default([]),
  defaultCity: z.string().max(80).default(''),
  defaultCompanyAge: z.string().default('LAST_30_DAYS'),
  minScore: z.number().int().min(0).max(100).default(60),
  weakWebsiteThreshold: z.number().int().min(0).max(100).default(55),
  thresholds: z
    .object({
      HOT: z.number().int().min(0).max(100),
      HIGH_OPPORTUNITY: z.number().int().min(0).max(100),
      WARM: z.number().int().min(0).max(100),
      LOW_PRIORITY: z.number().int().min(0).max(100),
    })
    .default({ HOT: 90, HIGH_OPPORTUNITY: 75, WARM: 60, LOW_PRIORITY: 40 }),
  retentionDays: z.number().int().min(30).max(3650).default(365),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export interface SettingsState {
  message?: string;
  error?: string;
}
