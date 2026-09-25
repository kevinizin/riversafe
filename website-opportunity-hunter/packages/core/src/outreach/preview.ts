import { getIndustry, industryLabel } from '../industry/taxonomy.js';
import type { OutreachFact } from './facts.js';

/**
 * One line of guidance inside a section.
 *
 * `confirmed` is what stops an unverified line being shown to a prospect as if
 * it were established. It used to be inferred downstream by pattern-matching
 * the English text ("to be supplied", "confirm"), which meant translating the
 * briefing would have silently switched the placeholder marking off — losing
 * the one safeguard this feature exists for. It is a field now.
 */
export interface BriefingNote {
  text: string;
  /** True only when the line states something we actually established. */
  confirmed: boolean;
}

/** Old briefings stored plain strings. Those are treated as unconfirmed, which
 *  errs towards marking something as a placeholder rather than away from it. */
export function normaliseNote(note: BriefingNote | string): BriefingNote {
  return typeof note === 'string' ? { text: note, confirmed: false } : note;
}

/**
 * Facts are written addressing the business ("vocês têm 127 avaliações"),
 * because that is how they read in an outreach email. A briefing talks *about*
 * the business and a homepage speaks *as* it, so the verb has to move twice:
 * second person → third for the briefing, third → first for the page.
 *
 * English hid this entirely — "you have", "they have" and "we have" are all
 * the same word — and swapping only the subject produces "Nós têm", which is
 * simply wrong. So all three forms are listed together, and any verb not in
 * the table is left exactly as it is: slightly stiff phrasing is a far smaller
 * failure than broken grammar on a page a prospect is meant to read.
 */
const VOICE: { second: string; third: string; first: string }[] = [
  { second: 'têm', third: 'tem', first: 'temos' },
  { second: 'estão', third: 'está', first: 'estamos' },
  { second: 'atuam', third: 'atua', first: 'atuamos' },
  { second: 'ficam', third: 'fica', first: 'ficamos' },
  { second: 'abriram', third: 'abriu', first: 'abrimos' },
  { second: 'receberam', third: 'recebeu', first: 'recebemos' },
];

/** "vocês têm 127 avaliações" → "A Demo Ltda tem 127 avaliações". */
export function toThirdPerson(statement: string, companyName: string): string {
  const match = /^vocês (\S+)(.*)$/s.exec(statement);
  if (!match) return statement;
  const verb = VOICE.find((v) => v.second === match[1]);
  if (!verb) return statement;
  return `A ${companyName} ${verb.third}${match[2]}`;
}

/** "A Demo Ltda tem 127 avaliações" → "Temos 127 avaliações". */
export function toFirstPersonVoice(statement: string, companyName: string): string {
  const prefix = `A ${companyName} `;
  if (!statement.startsWith(prefix)) return statement;
  const rest = statement.slice(prefix.length);
  const match = /^(\S+)(.*)$/s.exec(rest);
  if (!match) return statement;
  const verb = VOICE.find((v) => v.third === match[1]);
  if (!verb) return statement;
  return `${verb.first.charAt(0).toUpperCase()}${verb.first.slice(1)}${match[2]}`;
}

export interface BriefingSection {
  key: string;
  title: string;
  goal: string;
  contentNotes: BriefingNote[];
}

export interface PreviewBriefing {
  generatedAt: string;
  business: {
    name: string;
    industryKey: string | null;
    industry: string;
    location: string | null;
    country: string;
    currency: string;
    language: string;
  };
  /** Facts we hold with a source. Safe to put on the demo page. */
  confirmed: { label: string; value: string; source: string }[];
  /** Things the demo must NOT assert until the operator confirms them. */
  toConfirm: string[];
  suggestedServices: { name: string; status: 'SUGGESTED_FROM_INDUSTRY' | 'OBSERVED_ON_WEBSITE' }[];
  brand: { colourHints: string[]; source: string | null; detected: boolean; note: string };
  sections: BriefingSection[];
  primaryCta: string;
  tone: string;
  constraints: string[];
}

export interface BriefingInput {
  companyName: string;
  industryKey?: string | null;
  city?: string | null;
  region?: string | null;
  countryName: string;
  currency: string;
  language: string;
  facts: OutreachFact[];
  /** Hex colours observed on the existing site, if one was analysed. */
  brandColourHints?: string[];
  brandSourceDomain?: string | null;
  /** Service pages actually seen on the existing site. */
  observedServices?: string[];
  phone?: string | null;
  email?: string | null;
  reviewCount?: number | null;
  rating?: number | null;
  now?: Date;
}

/**
 * Produces the brief for a demonstration homepage.
 *
 * This is a brief, not a website, and certainly not a deployment: the system
 * never publishes to a prospect's domain and never claims services, prices or
 * credentials on their behalf. Anything not backed by a fact lands in
 * `toConfirm` so the operator has to make the call before showing it to anyone.
 */
export function buildPreviewBriefing(input: BriefingInput): PreviewBriefing {
  const now = input.now ?? new Date();
  const profile = input.industryKey ? getIndustry(input.industryKey) : undefined;
  const location = input.city ?? input.region ?? null;

  const confirmed = input.facts
    .filter((f) => f.confidence !== 'LOW')
    .map((f) => ({
      label: f.key.replace(/_/g, ' '),
      value: toThirdPerson(f.statement, input.companyName),
      source: f.sourceUrl ? `${f.source} (${f.sourceUrl})` : f.source,
    }));

  const observed = (input.observedServices ?? []).map((name) => ({
    name,
    status: 'OBSERVED_ON_WEBSITE' as const,
  }));
  const suggested = (profile?.typicalServices ?? []).map((name) => ({
    name,
    status: 'SUGGESTED_FROM_INDUSTRY' as const,
  }));
  const suggestedServices = [...observed, ...suggested.filter((s) => !observed.some((o) => o.name === s.name))];

  const toConfirm: string[] = [
    'Quais serviços a empresa realmente oferece, e como ela os chama',
    'Horário de funcionamento',
    'Se a empresa quer agendamento on-line',
  ];
  if (!input.phone) toConfirm.push('Um telefone para exibir');
  if (!input.email) toConfirm.push('Um e-mail ou destino para os contatos recebidos');
  if (!location) toConfirm.push('O endereço de operação a mostrar na página');
  if (suggested.length > 0) {
    toConfirm.push(
      `A lista sugerida de serviços vem do que empresas de ${industryLabel(input.industryKey ?? '')} costumam oferecer, não desta empresa — confirme antes de mostrar`,
    );
  }

  const sections: BriefingSection[] = [
    {
      key: 'hero',
      title: 'Topo',
      goal: 'Dizer o que a empresa faz, onde, e qual é o próximo passo — tudo acima da dobra.',
      contentNotes: [
        {
          text: `Título nomeando o serviço e a cidade, por exemplo "${profile?.label ?? 'Serviço'} em ${location ?? '[cidade]'}"`,
          confirmed: false,
        },
        { text: 'Uma frase de apoio. Nenhum superlativo que não se possa comprovar.', confirmed: false },
        { text: `Botão principal: ${primaryCtaFor(input.industryKey)}`, confirmed: false },
      ],
    },
    {
      key: 'services',
      title: 'Serviços',
      goal: 'Dar a cada serviço o seu próprio bloco, para virar uma página própria depois.',
      contentNotes: suggestedServices.slice(0, 6).map((s) =>
        s.status === 'OBSERVED_ON_WEBSITE'
          ? { text: `${s.name} (visto no site atual)`, confirmed: true }
          : { text: `${s.name} (sugerido para o setor — confirmar)`, confirmed: false },
      ),
    },
    {
      key: 'trust',
      title: 'Confiança',
      goal: 'Mostrar a prova que a empresa já tem, e nada que ela não tenha.',
      contentNotes: trustNotes(input),
    },
    {
      key: 'cta',
      title: 'Chamada para ação',
      goal: 'Repetir a única ação que você quer que o visitante tome.',
      contentNotes: [
        { text: primaryCtaFor(input.industryKey), confirmed: false },
        { text: 'Telefone como link de toque para ligar no celular', confirmed: false },
      ],
    },
    {
      key: 'contact',
      title: 'Contato',
      goal: 'Tornar trivial falar com a empresa pelo canal que o cliente prefere.',
      contentNotes: [
        input.phone
          ? { text: `Telefone: ${input.phone}`, confirmed: true }
          : { text: 'Telefone: a ser fornecido pela empresa', confirmed: false },
        input.email
          ? { text: `E-mail: ${input.email}`, confirmed: true }
          : { text: 'Formulário enviando para um endereço que a empresa fornecer', confirmed: false },
        { text: 'Formulário curto: nome, contato, mensagem. Nada além disso.', confirmed: false },
      ],
    },
    {
      key: 'location',
      title: 'Localização',
      goal: 'Responder "onde vocês ficam e vocês atendem aqui?".',
      contentNotes: [
        location
          ? { text: `Mapa e endereço de ${location}`, confirmed: true }
          : { text: 'Mapa assim que o endereço de operação for confirmado', confirmed: false },
        { text: 'Lista de áreas atendidas, que também serve de conteúdo para busca local', confirmed: false },
      ],
    },
  ];

  return {
    generatedAt: now.toISOString(),
    business: {
      name: input.companyName,
      industryKey: input.industryKey ?? null,
      industry: input.industryKey ? industryLabel(input.industryKey) : 'Não classificado',
      location,
      country: input.countryName,
      currency: input.currency,
      language: input.language,
    },
    confirmed,
    toConfirm,
    suggestedServices,
    brand: {
      colourHints: input.brandColourHints ?? [],
      source: input.brandSourceDomain ?? null,
      detected: (input.brandColourHints ?? []).length > 0,
      note: (input.brandColourHints ?? []).length
        ? `Cores amostradas do site existente em ${input.brandSourceDomain}. Trate como ponto de partida, não como manual de marca.`
        : 'Nenhuma cor de marca existente foi detectada. Escolha uma paleta neutra e confirme com a empresa.',
    },
    sections,
    primaryCta: primaryCtaFor(input.industryKey),
    tone: profile?.highTicket
      ? 'Ponderado e tranquilizador: para o cliente, esta é uma decisão de valor alto.'
      : 'Direto e prático: o visitante quer um preço, um horário ou um telefone.',
    constraints: [
      'Isto é apenas uma demonstração interna.',
      'Nunca publique no domínio do prospecto nem dê a entender que a empresa encomendou.',
      'Não afirme preços, qualificações, certificações, garantias ou nomes de funcionários que não estejam na lista de confirmados.',
      'Use imagens de preenchimento; não pegue fotografias do site nem das redes do prospecto.',
    ],
  };
}

function primaryCtaFor(industryKey: string | null | undefined): string {
  const profile = industryKey ? getIndustry(industryKey) : undefined;
  if (!profile) return 'Fale conosco';
  if (profile.bookingExpected) return 'Agendar horário';
  if (profile.highTicket) return 'Pedir orçamento gratuito';
  return 'Ligue hoje mesmo';
}

function trustNotes(input: BriefingInput): BriefingNote[] {
  const notes: BriefingNote[] = [];
  if (typeof input.reviewCount === 'number' && input.reviewCount > 0) {
    const rating = typeof input.rating === 'number' ? `, média ${input.rating.toFixed(1)}` : '';
    notes.push({
      text: `Avaliações: ${input.reviewCount}${rating} — cite a fonte e coloque o link`,
      confirmed: true,
    });
  } else {
    notes.push({
      text: 'Nenhum dado de avaliação disponível. Deixe um espaço para avaliações em vez de inventar alguma.',
      confirmed: false,
    });
  }
  notes.push({ text: 'Certificações: deixe em branco até a empresa fornecer', confirmed: false });
  notes.push({ text: 'Fotografia: só imagens de preenchimento até a empresa fornecer as próprias', confirmed: false });
  return notes;
}
