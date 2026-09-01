import type { PipelineContext } from '../pipeline/context.js';
import { enrichCompany, scoreCompany } from '../pipeline/stages.js';
import { runSearch } from '../pipeline/runSearch.js';
import type { JobHandlers } from './types.js';

/** The one place that maps a job type to the work it performs. */
export function createJobHandlers(ctx: PipelineContext): JobHandlers {
  return {
    'search.run': async ({ searchRunId }) => {
      await runSearch(ctx, searchRunId);
    },
    'company.enrich': async ({ companyId, requestedIndustryKeys }) => {
      await enrichCompany(ctx, companyId, {
        ...(requestedIndustryKeys ? { requestedIndustryKeys } : {}),
      });
    },
    'company.rescore': async ({ companyId }) => {
      await scoreCompany(ctx, companyId);
    },
  };
}
