import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCountry,
  getIndustry,
  greetingName,
  industryLabel,
  qualityBand,
  type PreviewBriefing,
} from '@woh/core';
import { prisma } from '@woh/db';
import { Card, ClassificationBadge, ConfidenceBadge, KeyValue, Notice, ScoreDial, SectionTitle, SizeBadge, Unknown } from '@/components/ui';
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
      // Both axes. `take: 1` would return whichever was written last, and label
      // a system score as the website one.
      scores: { orderBy: { computedAt: 'desc' }, take: 8 },
      outreach: { orderBy: { generatedAt: 'desc' }, take: 6 },
      websites: {
        orderBy: { isPrimary: 'desc' },
        include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      },
    },
  });
  if (!company) notFound();

  const score = company.scores.find((s) => s.axis === 'WEBSITE');
  const systemScore = company.scores.find((s) => s.axis === 'SYSTEM');
  const website = company.websites[0];
  const analysis = website?.analyses[0];
  const primaryIndustry = company.industries[0];
  type Breakdown = { component: string; points: number; max: number; reason: string }[];
  const breakdown = (score?.breakdown ?? []) as Breakdown;
  const systemBreakdown = (systemScore?.breakdown ?? []) as Breakdown;
  const emailDraft = company.outreach.find((o) => o.channel === 'email' && o.body);
  const briefingRow = company.outreach.find((o) => o.channel === 'website_preview' && o.previewBriefing);
  const briefing = briefingRow?.previewBriefing as PreviewBriefing | undefined;
  const checks = (analysis?.checks ?? []) as { key: string; label: string; passed: boolean; applicable: boolean; evidence: string }[];
  const officers = company.contacts.filter((c) => c.kind === 'OFFICER_ROLE');
  const decisionMaker = officers[0];
  const suggestedGreeting = greetingName(decisionMaker?.name);
  const systemUseCases = primaryIndustry ? (getIndustry(primaryIndustry.industryKey)?.systemUseCases ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="text-xs text-slate-500 hover:underline">← Voltar aos leads</Link>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-slate-500">
            {[company.city, company.region, company.postcode].filter(Boolean).join(' · ') || 'Localização desconhecida'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Site</p>
            <ScoreDial score={company.currentScore} />
            <div className="mt-1"><ClassificationBadge value={company.currentClassification} /></div>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Sistema</p>
            <ScoreDial score={company.systemScore} />
            <div className="mt-1"><ClassificationBadge value={company.systemClassification} /></div>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Porte</p>
            <div className="mt-2">
              <SizeBadge
                band={company.sizeBand}
                from={company.sizeEmployeesFrom}
                to={company.sizeEmployeesTo}
                fit={company.sizeFit}
              />
            </div>
            {company.sizeBasis.length ? (
              <p className="mt-1 max-w-[16rem] text-left text-[11px] leading-snug text-slate-500">
                {company.sizeBasis[company.sizeBasis.length - 1]}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <form action={setLeadStatusAction} className="flex items-end gap-2">
            <input type="hidden" name="companyId" value={company.id} />
            <div>
              <label className="label" htmlFor="status">Etapa no funil</label>
              <select id="status" name="status" defaultValue={company.leadStatus} className="input">
                {CRM_PIPELINE.map((status) => (
                  <option key={status} value={status}>{LEAD_STATUS_LABEL[status]}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-ghost">Atualizar</button>
          </form>

          <form action={setLeadStatusAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="status" value="CONTACTED" />
            <button type="submit" className="btn-ghost">Marcar como contatado</button>
          </form>

          <form action={setLeadStatusAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="status" value="DISCARDED" />
            <button type="submit" className="btn-ghost">Descartar</button>
          </form>

          <form action={reenrichAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-ghost">Rodar enriquecimento de novo</button>
          </form>

          <form action={rescoreAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-ghost">Recalcular score</button>
          </form>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Visão geral da empresa</SectionTitle>
          <dl>
            <KeyValue label="Razão social">{company.name}</KeyValue>
            <KeyValue label="CNPJ / registro">
              {company.companyNumber ? (
                <span className="font-mono">{company.companyNumber}</span>
              ) : (
                <Unknown note="Nenhum número de registro gravado para esta empresa" />
              )}
            </KeyValue>
            <KeyValue label="Setor">
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
            <KeyValue label="Códigos de atividade">
              {company.sicCodes.length ? company.sicCodes.join(', ') : <Unknown />}
            </KeyValue>
            <KeyValue label="Endereço registrado">
              {[company.addressLine1, company.addressLine2, company.city, company.postcode, company.country]
                .filter(Boolean)
                .join(', ') || <Unknown />}
            </KeyValue>
            <KeyValue label="Aberta em">
              {company.incorporationDate ? (
                <>
                  {formatDate(company.incorporationDate)}{' '}
                  <span className="text-slate-500">({relativeDays(company.incorporationDate)})</span>
                </>
              ) : (
                <Unknown />
              )}
            </KeyValue>
            <KeyValue label="Situação">{company.status}</KeyValue>
            <KeyValue label="Telefone">{company.phone ?? <Unknown />}</KeyValue>
          </dl>
          <SourceDisclosure countryCode={company.countryCode} />
        </Card>

        <Card>
          <SectionTitle>Presença digital</SectionTitle>
          <dl>
            <KeyValue label="Site">
              {website ? (
                <a href={website.url} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                  {website.domain}
                </a>
              ) : (
                <span>{WEBSITE_STATUS_LABEL[company.websiteStatus]}</span>
              )}
            </KeyValue>
            <KeyValue label="Situação do site">
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
            <KeyValue label="Avaliações">
              {company.reviewCount === null ? (
                <Unknown note="Nenhuma fonte de fichas de negócio configurada, então avaliações não são coletadas" />
              ) : (
                `${company.reviewCount}${company.rating ? ` · ${company.rating.toFixed(1)}★` : ''}`
              )}
            </KeyValue>
          </dl>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Do registro público de responsáveis. Só cargos, a menos que esta instalação opte por guardar nomes.">
          Quem decide
        </SectionTitle>
        {officers.length ? (
          <ul className="space-y-2 text-sm">
            {officers.map((officer, index) => (
              <li key={officer.id} className="border-b border-slate-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{officer.name ?? officer.role ?? 'Responsável'}</span>
                  {officer.name ? (
                    <span className="chip border border-slate-200 bg-slate-100 text-slate-600">
                      {officer.role}
                    </span>
                  ) : null}
                  {index === 0 ? (
                    <span className="chip border border-emerald-200 bg-emerald-50 text-emerald-700">
                      Melhor contato
                    </span>
                  ) : null}
                  <ConfidenceBadge value={officer.confidence} />
                </div>
                <p className="text-slate-600">{officer.evidence}</p>
                {officer.sourceUrl ? (
                  <a
                    href={officer.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-brand hover:underline"
                  >
                    Registro público de responsáveis
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhum decisor individual registrado. Ou o registro não lista nenhum responsável pessoa
            física ativo, ou a consulta de responsáveis ainda não rodou para esta empresa.
          </p>
        )}
        {officers.length > 0 && !decisionMaker?.name ? (
          <p className="mt-2 text-xs text-slate-500">
            Nomes de responsáveis não são coletados nesta instalação. Defina COLLECT_OFFICER_NAMES=true
            para guardá-los — são dados pessoais, então essa é uma escolha deliberada.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Por que o lead pontuou o que pontuou">Oportunidade de site</SectionTitle>
          {score ? (
            <>
              <div className="flex items-center gap-3">
                <ScoreDial score={score.score} />
                <div className="space-y-1">
                  <ClassificationBadge value={score.classification} />
                  <ConfidenceBadge value={score.confidence} prefix="Confiança do score" />
                  <p className="text-xs text-slate-500">Calculado em {formatDateTime(score.computedAt)}</p>
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
                    O que não conseguimos estabelecer
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
          <SectionTitle hint="Por que pontuou o que pontuou para um sistema de gestão">
            Oportunidade de sistema
          </SectionTitle>
          {systemScore ? (
            <>
              <div className="flex items-center gap-3">
                <ScoreDial score={systemScore.score} />
                <div className="space-y-1">
                  <ClassificationBadge value={systemScore.classification} />
                  <ConfidenceBadge value={systemScore.confidence} prefix="Confiança do score" />
                  <p className="text-xs text-slate-500">Calculado em {formatDateTime(systemScore.computedAt)}</p>
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <tbody>
                  {systemBreakdown.map((component) => (
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

              {systemScore.gaps.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    O que não conseguimos estabelecer
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                    {systemScore.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {systemUseCases.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    O que um sistema rodaria para eles
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                    {systemUseCases.map((useCase) => (
                      <li key={useCase}>{useCase}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-500">
                    Típico do setor, não observado nesta empresa — use como perguntas, não como
                    afirmações.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">This company has not been scored on the system axis yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Só verificações com evidência observável">Análise do site</SectionTitle>
          {analysis ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <ScoreDial score={analysis.qualityScore} />
                <div className="text-sm">
                  <p className="font-medium">
                    {analysis.qualityScore !== null ? qualityBand(analysis.qualityScore) : 'Sem pontuação'}
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
                ? 'Nenhum site foi encontrado, então não há o que analisar. É justamente isso que faz disto um lead.'
                : 'Nenhuma análise de site foi registrada ainda.'}
            </p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Cada afirmação acima, com a origem dela">Evidências</SectionTitle>
        <ul className="space-y-2 text-sm">
          {company.sources.map((source) => (
            <EvidenceItem
              key={source.id}
              title={`Registro obtido via ${source.provider}`}
              detail={source.externalId ?? ''}
              url={source.sourceUrl}
              at={source.fetchedAt}
              confidence={source.confidence}
            />
          ))}
          {company.websites.map((site) => (
            <EvidenceItem
              key={site.id}
              title={`Site ${site.domain}`}
              detail={`${site.discoveryMethod.toLowerCase().replace(/_/g, ' ')} — ${site.evidence ?? 'no evidence recorded'}`}
              url={site.url}
              at={site.firstSeenAt}
              confidence={site.confidence}
            />
          ))}
          {company.socials.map((social) => (
            <EvidenceItem
              key={social.id}
              title={`Perfil no ${social.platform}`}
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
          <SectionTitle hint="Redigido apenas a partir de fatos estabelecidos. Este sistema não envia nada.">
            Outreach
          </SectionTitle>
          <form action={prepareOutreachAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="companyId" value={company.id} />
            <div>
              <label className="label" htmlFor="senderName">Seu nome</label>
              <input id="senderName" name="senderName" required defaultValue={user.name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="senderBusiness">Sua empresa</label>
              <input id="senderBusiness" name="senderBusiness" className="input" placeholder="Opcional" />
            </div>
            <div>
              <label className="label" htmlFor="recipientName">Nome do destinatário</label>
              <input
                id="recipientName"
                name="recipientName"
                defaultValue={suggestedGreeting ?? ''}
                className="input"
                placeholder={suggestedGreeting ? undefined : 'Opcional'}
              />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary">Preparar abordagem</button>
            </div>
          </form>

          {emailDraft ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">
                Gerado em {formatDateTime(emailDraft.generatedAt)} por {emailDraft.generatedBy}
                {emailDraft.aiModel ? ` (${emailDraft.aiModel})` : ''}
              </p>
              <p className="text-sm font-medium">Assunto: {emailDraft.subject}</p>
              <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{emailDraft.body}</pre>
              <FactList facts={emailDraft.facts} />
              <form action={markOutreachSentAction}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="outreachId" value={emailDraft.id} />
                <button type="submit" className="btn-ghost">Já enviei isto</button>
              </form>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nenhum rascunho ainda.</p>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Um briefing interno para uma página de demonstração. Nunca publicado para o prospecto.">
            Website preview brief
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <form action={generatePreviewAction}>
              <input type="hidden" name="companyId" value={company.id} />
              <button type="submit" className="btn-primary">Gerar briefing da prévia</button>
            </form>
            <a
              href={`/api/leads/${company.id}/preview`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost"
            >
              Open demo homepage
            </a>
            <a href={`/api/leads/${company.id}/preview?download=1`} className="btn-ghost">
              Download HTML
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            A página de demonstração é gerada sob demanda e mostrada só para você. Ela leva um aviso
            dizendo quem a preparou e que não foi encomendada, e nunca é publicada em lugar nenhum.
          </p>

          {briefing ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium">{briefing.business.name}</p>
                <p className="text-slate-500">
                  {briefing.business.industry} · {briefing.business.location ?? 'localização a confirmar'} ·{' '}
                  {briefing.business.currency}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chamada principal</p>
                <p>{briefing.primaryCta}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seções</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmar antes de mostrar</p>
                <ul className="mt-1 list-inside list-disc text-slate-600">
                  {briefing.toConfirm.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {briefing.brand.colourHints.length ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Cores sugeridas</span>
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
            <p className="mt-3 text-sm text-slate-500">Nenhum briefing gerado ainda.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Anotações</SectionTitle>
          <form action={addNoteAction} className="flex gap-2">
            <input type="hidden" name="companyId" value={company.id} />
            <input name="body" required maxLength={4000} className="input" placeholder="Escreva uma anotação" />
            <button type="submit" className="btn-ghost mt-1">Adicionar</button>
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {company.notes.map((note) => (
              <li key={note.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p>{note.body}</p>
                <p className="text-xs text-slate-500">
                  {note.user?.name ?? 'Alguém'} · {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
            {company.notes.length === 0 ? <li className="text-slate-500">Nenhuma anotação ainda.</li> : null}
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="Proteção de dados">Tratamento do registro</SectionTitle>
          <dl>
            <KeyValue label="Fonte">{company.dataSource}</KeyValue>
            <KeyValue label="Coletado em">{formatDateTime(company.collectedAt)}</KeyValue>
            <KeyValue label="Finalidade">{company.purpose}</KeyValue>
            <KeyValue label="Retenção">{company.retentionStatus}</KeyValue>
            <KeyValue label="Contatos guardados">{company.contacts.length}</KeyValue>
          </dl>
          <form action={deleteCompanyAction} className="mt-3">
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-danger">
              Excluir esta empresa e todos os dados dela
            </button>
          </form>
          <p className="mt-1 text-xs text-slate-500">
            Isto é uma exclusão definitiva, não uma marcação escondida. O registro de auditoria guarda
            apenas que uma exclusão aconteceu.
          </p>
        </Card>
      </div>
    </div>
  );
}

/**
 * The answer to "where did you get my number?", ready to be read aloud.
 *
 * It sits beside the phone number because that is where the question gets
 * asked, and because the honest answer — a named public register the prospect
 * can check — is short and specific, while an improvised one under pressure
 * tends to be neither. The offer of erasure is part of the script rather than
 * a reaction to being pushed: the right to object is theirs either way.
 */
function SourceDisclosure({ countryCode }: { countryCode: string }) {
  const profile = getCountry(countryCode as Parameters<typeof getCountry>[0]);
  if (!profile) return null;

  const { answer, verifyUrl, offer } = profile.sourceDisclosure;

  return (
    <details className="mt-4 border-t border-slate-200 pt-3 text-sm">
      <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
        Se perguntarem de onde veio este contato
      </summary>
      <div className="mt-2 space-y-2 text-slate-700">
        <p>{answer}</p>
        <p>{offer}</p>
        <p className="text-xs text-slate-500">
          Quem quiser conferir vê o cadastro em{' '}
          <a
            href={verifyUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand hover:underline"
          >
            {new URL(verifyUrl).hostname}
          </a>
          . Apagar o lead nesta página apaga o registro de verdade, em cascata.
        </p>
      </div>
    </details>
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
        Fatos em que esta mensagem pode se apoiar
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
