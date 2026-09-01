import Link from 'next/link';
import { notFound } from 'next/navigation';
import { industryLabel, qualityBand, type PreviewBriefing } from '@woh/core';
import { prisma } from '@woh/db';
import { Card, ClassificationBadge, ConfidenceBadge, KeyValue, Notice, ScoreDial, SectionTitle, Unknown } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import {
  CRM_PIPELINE,
  LEAD_STATUS_LABEL,
  WEBSITE_STATUS_LABEL,
  formatDate,
  formatDateTime,
  relativeDays,
} from '@/lib/format';
import {
  addNoteAction,
  deleteCompanyAction,
  generatePreviewAction,
  markOutreachSentAction,
  prepareOutreachAction,
  reenrichAction,
  rescoreAction,
  setLeadStatusAction,
} from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      industries: { orderBy: { isPrimary: 'desc' } },
      sources: { orderBy: { fetchedAt: 'desc' } },
      socials: { orderBy: { detectedAt: 'desc' } },
      signals: { orderBy: { detectedAt: 'desc' } },
      contacts: true,
      notes: { orderBy: { createdAt: 'desc' }, include: { user: true } },
      scores: { orderBy: { computedAt: 'desc' }, take: 1 },
      outreach: { orderBy: { generatedAt: 'desc' }, take: 6 },
      websites: {
        orderBy: { isPrimary: 'desc' },
        include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      },
    },
  });
  if (!company) notFound();

  const score = company.scores[0];
  const website = company.websites[0];
  const analysis = website?.analyses[0];
  const primaryIndustry = company.industries[0];
  const breakdown = (score?.breakdown ?? []) as { component: string; points: number; max: number; reason: string }[];
  const emailDraft = company.outreach.find((o) => o.channel === 'email' && o.body);
  const briefingRow = company.outreach.find((o) => o.channel === 'website_preview' && o.previewBriefing);
  const briefing = briefingRow?.previewBriefing as PreviewBriefing | undefined;
  const checks = (analysis?.checks ?? []) as { key: string; label: string; passed: boolean; applicable: boolean; evidence: string }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="text-xs text-slate-500 hover:underline">← Back to leads</Link>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-slate-500">
            {[company.city, company.region, company.postcode].filter(Boolean).join(' · ') || 'Location unknown'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <ScoreDial score={company.currentScore} />
            <div className="mt-1"><ClassificationBadge value={company.currentClassification} /></div>
          </div>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <form action={setLeadStatusAction} className="flex items-end gap-2">
            <input type="hidden" name="companyId" value={company.id} />
            <div>
              <label className="label" htmlFor="status">Pipeline stage</label>
              <select id="status" name="status" defaultValue={company.leadStatus} className="input">
                {CRM_PIPELINE.map((status) => (
                  <option key={status} value={status}>{LEAD_STATUS_LABEL[status]}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-ghost">Update</button>
          </form>

          <form action={setLeadStatusAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="status" value="CONTACTED" />
            <button type="submit" className="btn-ghost">Mark contacted</button>
          </form>

          <form action={setLeadStatusAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="status" value="DISCARDED" />
            <button type="submit" className="btn-ghost">Discard</button>
          </form>

          <form action={reenrichAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-ghost">Re-run enrichment</button>
          </form>

          <form action={rescoreAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-ghost">Recalculate score</button>
          </form>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Company overview</SectionTitle>
          <dl>
            <KeyValue label="Company name">{company.name}</KeyValue>
            <KeyValue label="Company number">
              {company.companyNumber ? (
                <span className="font-mono">{company.companyNumber}</span>
              ) : (
                <Unknown note="No registry number recorded for this company" />
              )}
            </KeyValue>
            <KeyValue label="Industry">
              {primaryIndustry ? (
                <>
                  {industryLabel(primaryIndustry.industryKey)}
                  {primaryIndustry.subIndustryKey ? ` · ${primaryIndustry.subIndustryKey}` : ''}{' '}
                  <ConfidenceBadge value={primaryIndustry.confidence} prefix="Match" />
                  <span className="ml-2 text-xs text-slate-500">{primaryIndustry.evidence}</span>
                </>
              ) : (
                <Unknown note="No SIC code or keyword matched a known industry" />
              )}
            </KeyValue>
            <KeyValue label="SIC codes">
              {company.sicCodes.length ? company.sicCodes.join(', ') : <Unknown />}
            </KeyValue>
            <KeyValue label="Registered office">
              {[company.addressLine1, company.addressLine2, company.city, company.postcode, company.country]
                .filter(Boolean)
                .join(', ') || <Unknown />}
            </KeyValue>
            <KeyValue label="Incorporated">
              {company.incorporationDate ? (
                <>
                  {formatDate(company.incorporationDate)}{' '}
                  <span className="text-slate-500">({relativeDays(company.incorporationDate)})</span>
                </>
              ) : (
                <Unknown />
              )}
            </KeyValue>
            <KeyValue label="Status">{company.status}</KeyValue>
            <KeyValue label="Phone">{company.phone ?? <Unknown />}</KeyValue>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Digital presence</SectionTitle>
          <dl>
            <KeyValue label="Website">
              {website ? (
                <a href={website.url} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                  {website.domain}
                </a>
              ) : (
                <span>{WEBSITE_STATUS_LABEL[company.websiteStatus]}</span>
              )}
            </KeyValue>
            <KeyValue label="Website status">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{WEBSITE_STATUS_LABEL[company.websiteStatus]}</span>
                  <ConfidenceBadge value={company.websiteConfidence} />
                </div>
                {company.websiteStatusNote ? (
                  <p className="text-xs text-slate-500">{company.websiteStatusNote}</p>
                ) : null}
              </div>
            </KeyValue>
            {(['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'GOOGLE_BUSINESS'] as const).map((platform) => {
              const profile = company.socials.find((s) => s.platform === platform);
              return (
                <KeyValue key={platform} label={platform.replace('_', ' ').toLowerCase()}>
                  {profile ? (
                    <a href={profile.url} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                      {profile.handle ?? profile.url}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">Not found</span>
                  )}
                </KeyValue>
              );
            })}
            <KeyValue label="Reviews">
              {company.reviewCount === null ? (
                <Unknown note="No places provider is configured, so review counts are not collected" />
              ) : (
                `${company.reviewCount}${company.rating ? ` · ${company.rating.toFixed(1)}★` : ''}`
              )}
            </KeyValue>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Why the lead scored what it did">Opportunity</SectionTitle>
          {score ? (
            <>
              <div className="flex items-center gap-3">
                <ScoreDial score={score.score} />
                <div className="space-y-1">
                  <ClassificationBadge value={score.classification} />
                  <ConfidenceBadge value={score.confidence} prefix="Score confidence" />
                  <p className="text-xs text-slate-500">Computed {formatDateTime(score.computedAt)}</p>
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <tbody>
                  {breakdown.map((component) => (
                    <tr key={component.component + component.reason} className="border-b border-slate-100 last:border-0">
                      <td className="table-cell w-16 text-right font-semibold tabular-nums">
                        {component.points > 0 ? `+${component.points}` : component.points}
                      </td>
                      <td className="table-cell text-slate-400">/ {component.max}</td>
                      <td className="table-cell">{component.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {score.gaps.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What we could not establish
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                    {score.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">This company has not been scored yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Only checks with observable evidence">Website analysis</SectionTitle>
          {analysis ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <ScoreDial score={analysis.qualityScore} />
                <div className="text-sm">
                  <p className="font-medium">
                    {analysis.qualityScore !== null ? qualityBand(analysis.qualityScore) : 'Not scored'}
                  </p>
                  <p className="text-slate-500">
                    {analysis.detectedPlatform ? `${analysis.detectedPlatform} · ` : ''}
                    {analysis.responseTimeMs ? `${analysis.responseTimeMs}ms` : 'response time unknown'}
                  </p>
                  <p className="text-xs text-slate-400">Checked {formatDateTime(analysis.fetchedAt)}</p>
                </div>
              </div>

              {analysis.errorCode ? (
                <div className="mt-3">
                  <Notice tone="warn">
                    {analysis.errorCode}: {analysis.errorMessage ?? 'the site could not be analysed'}
                  </Notice>
                </div>
              ) : null}

              {analysis.weaknesses.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weaknesses</p>
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {analysis.weaknesses.map((weakness) => (
                      <li key={weakness}>{weakness}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {checks.length ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-slate-600">
                    All {checks.filter((c) => c.applicable).length} checks and their evidence
                  </summary>
                  <ul className="mt-2 space-y-1 text-sm">
                    {checks
                      .filter((c) => c.applicable)
                      .map((check) => (
                        <li key={check.key} className="flex gap-2">
                          <span aria-hidden>{check.passed ? '✅' : '❌'}</span>
                          <span>
                            <span className="font-medium">{check.label}</span>
                            <span className="text-slate-500"> — {check.evidence}</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {company.websiteStatus === 'NO_WEBSITE_FOUND'
                ? 'No website was found, so there is nothing to analyse. That is what makes this a lead.'
                : 'No website analysis has been recorded yet.'}
            </p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Every claim above, with where it came from">Evidence</SectionTitle>
        <ul className="space-y-2 text-sm">
          {company.sources.map((source) => (
            <EvidenceItem
              key={source.id}
              title={`Registry record via ${source.provider}`}
              detail={source.externalId ?? ''}
              url={source.sourceUrl}
              at={source.fetchedAt}
              confidence={source.confidence}
            />
          ))}
          {company.websites.map((site) => (
            <EvidenceItem
              key={site.id}
              title={`Website ${site.domain}`}
              detail={`${site.discoveryMethod.toLowerCase().replace(/_/g, ' ')} — ${site.evidence ?? 'no evidence recorded'}`}
              url={site.url}
              at={site.firstSeenAt}
              confidence={site.confidence}
            />
          ))}
          {company.socials.map((social) => (
            <EvidenceItem
              key={social.id}
              title={`${social.platform} profile`}
              detail={social.evidence ?? ''}
              url={social.url}
              at={social.detectedAt}
              confidence={social.confidence}
            />
          ))}
          {company.signals.map((signal) => (
            <EvidenceItem
              key={signal.id}
              title={signal.type.toLowerCase().replace(/_/g, ' ')}
              detail={signal.evidence}
              url={signal.sourceUrl}
              at={signal.detectedAt}
              confidence={signal.confidence}
            />
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Drafted from established facts only. Nothing is sent by this system.">
            Outreach
          </SectionTitle>
          <form action={prepareOutreachAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="companyId" value={company.id} />
            <div>
              <label className="label" htmlFor="senderName">Your name</label>
              <input id="senderName" name="senderName" required defaultValue={user.name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="senderBusiness">Your business</label>
              <input id="senderBusiness" name="senderBusiness" className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="recipientName">Recipient name</label>
              <input id="recipientName" name="recipientName" className="input" placeholder="Optional" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary">Prepare outreach</button>
            </div>
          </form>

          {emailDraft ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">
                Generated {formatDateTime(emailDraft.generatedAt)} by {emailDraft.generatedBy}
                {emailDraft.aiModel ? ` (${emailDraft.aiModel})` : ''}
              </p>
              <p className="text-sm font-medium">Subject: {emailDraft.subject}</p>
              <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{emailDraft.body}</pre>
              <FactList facts={emailDraft.facts} />
              <form action={markOutreachSentAction}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="outreachId" value={emailDraft.id} />
                <button type="submit" className="btn-ghost">I have sent this</button>
              </form>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No draft yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle hint="An internal brief for a demo homepage. Never published to the prospect.">
            Website preview brief
          </SectionTitle>
          <form action={generatePreviewAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-primary">Generate preview brief</button>
          </form>

          {briefing ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium">{briefing.business.name}</p>
                <p className="text-slate-500">
                  {briefing.business.industry} · {briefing.business.location ?? 'location to confirm'} ·{' '}
                  {briefing.business.currency}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary call to action</p>
                <p>{briefing.primaryCta}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</p>
                <ul className="mt-1 space-y-1">
                  {briefing.sections.map((section) => (
                    <li key={section.key}>
                      <span className="font-medium">{section.title}</span>
                      <span className="text-slate-500"> — {section.goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm before showing</p>
                <ul className="mt-1 list-inside list-disc text-slate-600">
                  {briefing.toConfirm.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {briefing.brand.colourHints.length ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Colour hints</span>
                  {briefing.brand.colourHints.map((hex) => (
                    <span key={hex} className="flex items-center gap-1 text-xs">
                      <span className="inline-block h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: hex }} />
                      {hex}
                    </span>
                  ))}
                </div>
              ) : null}
              <Notice tone="warn">{briefing.constraints[1]}</Notice>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No brief generated yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Notes</SectionTitle>
          <form action={addNoteAction} className="flex gap-2">
            <input type="hidden" name="companyId" value={company.id} />
            <input name="body" required maxLength={4000} className="input" placeholder="Add a note" />
            <button type="submit" className="btn-ghost mt-1">Add</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {company.notes.map((note) => (
              <li key={note.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p>{note.body}</p>
                <p className="text-xs text-slate-500">
                  {note.user?.name ?? 'Someone'} · {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
            {company.notes.length === 0 ? <li className="text-slate-500">No notes yet.</li> : null}
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="Data protection">Record handling</SectionTitle>
          <dl>
            <KeyValue label="Source">{company.dataSource}</KeyValue>
            <KeyValue label="Collected">{formatDateTime(company.collectedAt)}</KeyValue>
            <KeyValue label="Purpose">{company.purpose}</KeyValue>
            <KeyValue label="Retention">{company.retentionStatus}</KeyValue>
            <KeyValue label="Contacts stored">{company.contacts.length}</KeyValue>
          </dl>
          <form action={deleteCompanyAction} className="mt-3">
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-danger">
              Delete this company and all its data
            </button>
          </form>
          <p className="mt-1 text-xs text-slate-500">
            This is a permanent erasure, not a hidden flag. The audit log keeps only that a deletion
            happened.
          </p>
        </Card>
      </div>
    </div>
  );
}

function EvidenceItem({
  title,
  detail,
  url,
  at,
  confidence,
}: {
  title: string;
  detail: string;
  url?: string | null;
  at: Date;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}) {
  return (
    <li className="border-b border-slate-100 pb-2 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium capitalize">{title}</span>
        <ConfidenceBadge value={confidence} />
        <span className="text-xs text-slate-500">{formatDateTime(at)}</span>
      </div>
      {detail ? <p className="text-slate-600">{detail}</p> : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="break-all text-xs text-brand hover:underline">
          {url}
        </a>
      ) : null}
    </li>
  );
}

function FactList({ facts }: { facts: unknown }) {
  if (!Array.isArray(facts)) return null;
  const items = facts as { statement?: string; evidence?: string }[];
  if (!items.length || !items[0]?.statement) return null;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-slate-600">
        Facts this message is allowed to rely on
      </summary>
      <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
        {items.map((fact, index) => (
          <li key={index}>
            {fact.statement} — <span className="text-slate-500">{fact.evidence}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
