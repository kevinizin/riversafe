'use server';

import { prisma, type Prisma } from '@woh/db';
import { revalidatePath } from 'next/cache';
import { audit, requireUser } from '@/lib/auth';
import { SETTINGS_KEY, settingsSchema, type AppSettings, type SettingsState } from './schema';

export async function loadSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findFirst({ where: { userId: null, key: SETTINGS_KEY } });
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({});
}

/**
 * Saves the installation defaults.
 *
 * The classification thresholds are validated as a descending ladder: an
 * inverted set would silently classify every lead into the wrong band, which is
 * exactly the sort of quiet breakage that is hard to notice later.
 */
export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const num = (key: string, fallback: number): number => {
    const value = Number(formData.get(key));
    return Number.isFinite(value) ? value : fallback;
  };

  const candidate = {
    countryCode: String(formData.get('countryCode') ?? 'GB'),
    defaultIndustryKeys: formData.getAll('defaultIndustryKeys').map(String).filter(Boolean),
    defaultCity: String(formData.get('defaultCity') ?? ''),
    defaultCompanyAge: String(formData.get('defaultCompanyAge') ?? 'LAST_30_DAYS'),
    minScore: num('minScore', 60),
    weakWebsiteThreshold: num('weakWebsiteThreshold', 55),
    thresholds: {
      HOT: num('thresholdHot', 90),
      HIGH_OPPORTUNITY: num('thresholdHigh', 75),
      WARM: num('thresholdWarm', 60),
      LOW_PRIORITY: num('thresholdLow', 40),
    },
    retentionDays: num('retentionDays', 365),
  };

  const parsed = settingsSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those settings could not be saved.' };
  }

  const { HOT, HIGH_OPPORTUNITY, WARM, LOW_PRIORITY } = parsed.data.thresholds;
  if (!(HOT > HIGH_OPPORTUNITY && HIGH_OPPORTUNITY > WARM && WARM > LOW_PRIORITY)) {
    return { error: 'Thresholds must descend: hot > high opportunity > warm > low priority.' };
  }

  const existing = await prisma.setting.findFirst({ where: { userId: null, key: SETTINGS_KEY } });
  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value: parsed.data as unknown as Prisma.InputJsonValue },
    });
  } else {
    await prisma.setting.create({
      data: { userId: null, key: SETTINGS_KEY, value: parsed.data as unknown as Prisma.InputJsonValue },
    });
  }

  await audit(user.userId, 'settings.saved', 'setting', SETTINGS_KEY);
  revalidatePath('/settings');
  return { message: 'Settings saved. New scores use the updated thresholds.' };
}
