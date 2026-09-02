'use server';

import {
  buildOutreachFacts,
  buildPreviewBriefing,
  completeWithBudget,
  generateOutreachDraft,
  buildAiProvider,
  outreachReadiness,
  personalisationSystemPrompt,
  requireCountry,
  validatePersonalisation,
} from '@woh/core';
import { prisma, type Prisma } from '@woh/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit, requireUser } from '@/lib/auth';
import { env, queue } from '@/lib/context';

const idSchema = z.string().uuid();

const LEAD_STATUSES = [
  'NEW', 'QUALIFIED', 'PREVIEW_CREATED', 'CONTACT_READY', 'CONTACTED', 'REPLIED',
  'INTERESTED', 'DEMO', 'PROPOSAL', 'WON', 'LOST', 'DISCARDED',
] as const;

export async function setLeadStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  const status = z.enum(LEAD_STATUSES).parse(formData.get('status'));

  await prisma.company.update({
    where: { id: companyId },
    data: {
      leadStatus: status,
      leadStatusAt: new Date(),
      ...(status === 'CONTACTED' ? { contactedAt: new Date() } : {}),
      ...(status === 'DISCARDED' ? { discardedAt: new Date() } : {}),
    },
  });
  await audit(user.userId, 'lead.status_changed', 'company', companyId, { status });
  revalidatePath(`/leads/${companyId}`);
  revalidatePath('/crm');
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  const body = z.string().trim().min(1).max(4000).parse(formData.get('body'));

  await prisma.note.create({ data: { companyId, userId: user.userId, body } });
  await audit(user.userId, 'note.added', 'company', companyId);
  revalidatePath(`/leads/${companyId}`);
}

export async function rescoreAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  await queue().enqueue('company.rescore', { companyId });
  await audit(user.userId, 'lead.rescore_requested', 'company', companyId);
  revalidatePath(`/leads/${companyId}`);
}

export async function reenrichAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  await queue().enqueue('company.enrich', { companyId });
  await audit(user.userId, 'lead.reenrich_requested', 'company', companyId);
  revalidatePath(`/leads/${companyId}`);
}

/**
 * Prepares an outreach draft.
 *
 * Everything the message says comes from `buildOutreachFacts`, which reads only
 * what is stored with a source. If AI personalisation is enabled, the rewrite is
 * validated against the same fact list and discarded if it introduced anything
 * new — the deterministic draft is kept instead.
 */
export async function prepareOutreachAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  const senderName = z.string().trim().min(1).max(120).parse(formData.get('senderName'));
  const senderBusiness = String(formData.get('senderBusiness') ?? '').trim();
  const recipientName = String(formData.get('recipientName') ?? '').trim();

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      industries: { where: { isPrimary: true }, take: 1 },
      socials: true,
      signals: true,
      contacts: true,
      websites: {
        where: { isPrimary: true },
        take: 1,
        include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      },
    },
  });

  const analysis = company.websites[0]?.analyses[0];
  const facts = buildOutreachFacts({
    companyName: company.name,
    city: company.city,
    incorporationDate: company.incorporationDate,
    industryKey: company.industries[0]?.industryKey,
    websiteStatus: company.websiteStatus,
    websiteStatusNote: company.websiteStatusNote,
    websiteDomain: company.websites[0]?.domain,
    websiteQualityScore: analysis?.qualityScore,
    websiteWeaknesses: analysis?.weaknesses ?? [],
    socialProfiles: company.socials.map((s) => ({ platform: s.platform, url: s.url, confidence: s.confidence })),
    reviewCount: company.reviewCount,
    rating: company.rating,
    signals: company.signals.map((s) => ({
      type: s.type,
      evidence: s.evidence,
      confidence: s.confidence,
      sourceUrl: s.sourceUrl,
    })),
  });

  const draft = generateOutreachDraft({
    companyName: company.name,
    recipientName: recipientName || null,
    senderName,
    ...(senderBusiness ? { senderBusiness } : {}),
    industryKey: company.industries[0]?.industryKey,
    city: company.city,
    facts,
  });

  if (draft.blockedReason) {
    await prisma.outreachCandidate.create({
      data: {
        companyId,
        status: 'DRAFT',
        subject: null,
        body: null,
        facts: { blockedReason: draft.blockedReason } as Prisma.InputJsonValue,
        generatedBy: 'template',
      },
    });
    revalidatePath(`/leads/${companyId}`);
    return;
  }

  let body = draft.body;
  let generatedBy = 'template';
  let aiModel: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  const config = env();
  if (config.AI_PROVIDER !== 'none') {
    try {
      const provider = buildAiProvider(config);
      const response = await completeWithBudget(provider, prisma, config, {
        purpose: 'outreach_personalisation',
        companyId,
        system: personalisationSystemPrompt(),
        prompt: [
          `ALLOWED FACTS about ${company.name}:`,
          ...facts.map((f) => `- ${f.statement} (evidence: ${f.evidence})`),
          '',
          'DRAFT TO REWRITE:',
          draft.body,
        ].join('\n'),
        maxTokens: 500,
      });
      const check = validatePersonalisation(response.text, facts, company.name);
      if (check.ok) {
        body = response.text;
        generatedBy = 'ai';
        aiModel = response.model;
        inputTokens = response.inputTokens;
        outputTokens = response.outputTokens;
      } else {
        generatedBy = 'template (AI rewrite rejected)';
      }
    } catch {
      // AI is an enhancement; the deterministic draft already stands on its own.
      generatedBy = 'template (AI unavailable)';
    }
  }

  await prisma.outreachCandidate.create({
    data: {
      companyId,
      status: 'READY',
      subject: draft.subject,
      body,
      facts: draft.usedFacts as unknown as Prisma.InputJsonValue,
      generatedBy,
      aiModel,
      inputTokens,
      outputTokens,
    },
  });

  const readiness = outreachReadiness({
    score: company.currentScore,
    facts,
    hasContactRoute: !!company.phone || !!company.email || company.contacts.length > 0,
  });
  if (readiness.ready && company.leadStatus === 'NEW') {
    await prisma.company.update({
      where: { id: companyId },
      data: { leadStatus: 'CONTACT_READY', leadStatusAt: new Date() },
    });
  }

  await audit(user.userId, 'outreach.prepared', 'company', companyId, { generatedBy });
  revalidatePath(`/leads/${companyId}`);
}

/** Builds the demo-homepage brief. It is stored, never published anywhere. */
export async function generatePreviewAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      industries: { where: { isPrimary: true }, take: 1 },
      socials: true,
      signals: true,
      contacts: true,
      websites: {
        where: { isPrimary: true },
        take: 1,
        include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      },
    },
  });

  const country = requireCountry(company.countryCode);
  const analysis = company.websites[0]?.analyses[0];
  const facts = buildOutreachFacts({
    companyName: company.name,
    city: company.city,
    incorporationDate: company.incorporationDate,
    industryKey: company.industries[0]?.industryKey,
    websiteStatus: company.websiteStatus,
    websiteStatusNote: company.websiteStatusNote,
    websiteDomain: company.websites[0]?.domain,
    websiteQualityScore: analysis?.qualityScore,
    websiteWeaknesses: analysis?.weaknesses ?? [],
    socialProfiles: company.socials.map((s) => ({ platform: s.platform, url: s.url, confidence: s.confidence })),
    reviewCount: company.reviewCount,
    rating: company.rating,
  });

  const briefing = buildPreviewBriefing({
    companyName: company.name,
    industryKey: company.industries[0]?.industryKey,
    city: company.city,
    region: company.region,
    countryName: country.name,
    currency: country.currency,
    language: country.language,
    facts,
    brandColourHints: analysis?.brandColourHints ?? [],
    brandSourceDomain: company.websites[0]?.domain ?? null,
    phone: company.phone,
    email: company.email,
    reviewCount: company.reviewCount,
    rating: company.rating,
  });

  await prisma.outreachCandidate.create({
    data: {
      companyId,
      status: 'DRAFT',
      channel: 'website_preview',
      previewBriefing: briefing as unknown as Prisma.InputJsonValue,
      generatedBy: 'template',
    },
  });

  if (company.leadStatus === 'NEW' || company.leadStatus === 'QUALIFIED') {
    await prisma.company.update({
      where: { id: companyId },
      data: { leadStatus: 'PREVIEW_CREATED', leadStatusAt: new Date() },
    });
  }

  await audit(user.userId, 'preview.generated', 'company', companyId);
  revalidatePath(`/leads/${companyId}`);
}

export async function markOutreachSentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const outreachId = idSchema.parse(formData.get('outreachId'));
  const companyId = idSchema.parse(formData.get('companyId'));

  await prisma.outreachCandidate.update({
    where: { id: outreachId },
    data: { status: 'SENT', markedSentAt: new Date() },
  });
  await prisma.company.update({
    where: { id: companyId },
    data: { leadStatus: 'CONTACTED', leadStatusAt: new Date(), contactedAt: new Date() },
  });
  await audit(user.userId, 'outreach.marked_sent', 'company', companyId, { outreachId });
  revalidatePath(`/leads/${companyId}`);
}

/**
 * Erases a company and everything attached to it.
 *
 * A real delete, not a flag: UK GDPR erasure means the personal data is gone.
 * The audit log keeps the fact that a deletion happened, with no personal data
 * in it.
 */
export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));

  await prisma.company.delete({ where: { id: companyId } });
  await audit(user.userId, 'company.deleted', 'company', companyId, { reason: 'operator request' });

  revalidatePath('/leads');
  redirect('/leads');
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contactId = idSchema.parse(formData.get('contactId'));
  const companyId = idSchema.parse(formData.get('companyId'));

  await prisma.contact.delete({ where: { id: contactId } });
  await audit(user.userId, 'contact.deleted', 'contact', contactId, { companyId });
  revalidatePath(`/leads/${companyId}`);
}

export async function addContactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = idSchema.parse(formData.get('companyId'));
  const parsed = z
    .object({
      kind: z.enum(['BUSINESS_EMAIL', 'BUSINESS_PHONE', 'CONTACT_FORM', 'OFFICER_ROLE']),
      role: z.string().trim().max(120).optional(),
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().email().optional().or(z.literal('')),
      phone: z.string().trim().max(40).optional(),
      url: z.string().trim().url().optional().or(z.literal('')),
      source: z.string().trim().min(1).max(200),
    })
    .parse({
      kind: formData.get('kind'),
      role: formData.get('role') ?? undefined,
      name: formData.get('name') ?? undefined,
      email: formData.get('email') ?? undefined,
      phone: formData.get('phone') ?? undefined,
      url: formData.get('url') ?? undefined,
      source: formData.get('source') || 'entered by operator',
    });

  await prisma.contact.create({
    data: {
      companyId,
      kind: parsed.kind,
      role: parsed.role || null,
      name: parsed.name || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      url: parsed.url || null,
      source: parsed.source,
      confidence: 'HIGH',
      evidence: 'entered manually by the operator',
      isPersonal: !!parsed.name,
    },
  });
  await audit(user.userId, 'contact.added', 'company', companyId, { kind: parsed.kind });
  revalidatePath(`/leads/${companyId}`);
}
