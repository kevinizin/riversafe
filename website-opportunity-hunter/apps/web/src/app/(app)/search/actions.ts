'use server';

import { describeFilters, searchFiltersSchema } from '@woh/core';
import { prisma, type Prisma } from '@woh/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit, requireUser } from '@/lib/auth';
import { queue } from '@/lib/context';

/** Reads the search form. Unchecked boxes are absent, hence the `=== 'on'`. */
function readFilters(formData: FormData) {
  const industryKeys = formData.getAll('industryKeys').map(String).filter(Boolean);
  const minScore = Number(formData.get('minScore') ?? 0);
  const maxCompanies = Number(formData.get('maxCompanies') ?? 200);
  const minReviews = formData.get('minReviews');

  return searchFiltersSchema.parse({
    countryCode: String(formData.get('countryCode') ?? 'GB'),
    industryKeys,
    region: emptyToUndefined(formData.get('region')),
    city: emptyToUndefined(formData.get('city')),
    postcodePrefix: emptyToUndefined(formData.get('postcodePrefix')),
    companyAge: String(formData.get('companyAge') ?? 'LAST_30_DAYS'),
    websiteFilter: String(formData.get('websiteFilter') ?? 'ANY'),
    minScore: Number.isFinite(minScore) ? minScore : 0,
    minReviews: minReviews && String(minReviews).length ? Number(minReviews) : undefined,
    requireSocialPresence: formData.get('requireSocialPresence') === 'on',
    statuses: ['active'],
    nameIncludes: emptyToUndefined(formData.get('nameIncludes')),
    maxCompanies: Number.isFinite(maxCompanies) ? maxCompanies : 200,
    skipWebsiteAnalysis: formData.get('skipWebsiteAnalysis') === 'on',
  });
}

const emptyToUndefined = (value: FormDataEntryValue | null): string | undefined => {
  const text = value ? String(value).trim() : '';
  return text.length ? text : undefined;
};

export interface SearchFormState {
  error?: string;
}

/**
 * Creates a saved search, opens a run for it and hands the run to the queue.
 *
 * The HTTP request returns as soon as the job is queued; the work itself
 * happens in the worker (or inline, in development), so a search over hundreds
 * of companies never sits inside a page request.
 */
export async function createSearchAction(
  _prev: SearchFormState,
  formData: FormData,
): Promise<SearchFormState> {
  const user = await requireUser();

  let filters;
  try {
    filters = readFilters(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'The search could not be validated.' };
  }

  const name = String(formData.get('name') ?? '').trim() || describeFilters(filters);

  const search = await prisma.search.create({
    data: { userId: user.userId, name, filters: filters as unknown as Prisma.InputJsonValue },
  });
  const run = await prisma.searchRun.create({ data: { searchId: search.id, status: 'QUEUED' } });

  const jobId = await queue().enqueue('search.run', { searchRunId: run.id });
  await prisma.searchRun.update({ where: { id: run.id }, data: { jobId } });
  await audit(user.userId, 'search.created', 'search', search.id, { filters });

  revalidatePath('/searches');
  redirect(`/searches/${run.id}`);
}

/** Re-runs a saved search with exactly the filters it was saved with. */
export async function rerunSearchAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const searchId = String(formData.get('searchId') ?? '');
  const search = await prisma.search.findUnique({ where: { id: searchId } });
  if (!search) return;

  const run = await prisma.searchRun.create({ data: { searchId: search.id, status: 'QUEUED' } });
  const jobId = await queue().enqueue('search.run', { searchRunId: run.id });
  await prisma.searchRun.update({ where: { id: run.id }, data: { jobId } });
  await audit(user.userId, 'search.rerun', 'search', search.id);

  revalidatePath('/searches');
  redirect(`/searches/${run.id}`);
}
