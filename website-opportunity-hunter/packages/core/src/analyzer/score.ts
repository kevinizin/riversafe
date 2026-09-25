import type { PageFacts } from './extract.js';

export interface QualityCheck {
  key: string;
  label: string;
  /** Relative importance. The final score is passed weight / applicable weight. */
  weight: number;
  /** False when the check does not apply to this business (e.g. online booking
   *  for a law firm). Inapplicable checks are excluded from the denominator so
   *  a business is never marked down for lacking something it does not need. */
  applicable: boolean;
  passed: boolean;
  /** What was observed. Populated for passes and failures alike. */
  evidence: string;
  /** Sentence used in the weaknesses list when the check fails. */
  weakness?: string;
}

export interface WebsiteQuality {
  score: number;
  checks: QualityCheck[];
  weaknesses: string[];
  strengths: string[];
}

export interface QualityContext {
  responseTimeMs?: number;
  /** From the industry profile. Controls whether booking is expected. */
  bookingExpected?: boolean;
  brokenLinkCount?: number;
  checkedLinkCount?: number;
}

const TITLE_MIN = 15;
const TITLE_MAX = 70;
const SLOW_MS = 2_500;

/**
 * Scores a website 0–100 from observed facts.
 *
 * Two deliberate constraints:
 *  1. Every check is mechanical. There is no "the design looks dated" check —
 *     only "the markup contains <font> tags", which a human can verify.
 *  2. Inapplicable checks leave the denominator, so a solicitor without an
 *     online booking widget is not penalised for it.
 */
export function scoreWebsite(facts: PageFacts, ctx: QualityContext = {}): WebsiteQuality {
  const bookingExpected = ctx.bookingExpected ?? false;
  const titleLength = facts.title?.length ?? 0;
  const hasContactRoute = facts.hasContactForm || facts.emails.length > 0 || facts.phones.length > 0;

  const checks: QualityCheck[] = [
    {
      key: 'https',
      label: 'Servido por HTTPS',
      weight: 8,
      applicable: true,
      passed: facts.https,
      evidence: facts.https ? 'a URL final usa https://' : 'a URL final usa http://',
      weakness: 'Sem HTTPS — os navegadores mostram o site como "Não seguro"',
    },
    {
      key: 'responsive',
      label: 'Viewport para celular declarada',
      weight: 10,
      applicable: true,
      passed: facts.hasViewportMeta,
      evidence: facts.hasViewportMeta
        ? '<meta name="viewport"> presente'
        : 'sem a tag <meta name="viewport">, então a página não se adapta ao celular',
      weakness: 'Não foi feito para celular — sem a tag viewport, o telefone renderiza o layout de computador',
    },
    {
      key: 'title',
      label: 'Título de página útil',
      weight: 6,
      applicable: true,
      passed: titleLength >= TITLE_MIN && titleLength <= TITLE_MAX,
      evidence: facts.title
        ? `<title> com ${titleLength} caracteres: "${facts.title.slice(0, 80)}"`
        : 'sem tag <title>',
      weakness: facts.title
        ? `O título tem ${titleLength} caracteres — fora da faixa de ${TITLE_MIN} a ${TITLE_MAX} que os resultados de busca exibem bem`
        : 'Sem título de página',
    },
    {
      key: 'meta_description',
      label: 'Meta descrição',
      weight: 5,
      applicable: true,
      passed: !!facts.metaDescription && facts.metaDescription.length >= 50,
      evidence: facts.metaDescription
        ? `meta descrição com ${facts.metaDescription.length} caracteres`
        : 'sem meta descrição',
      weakness: 'Sem meta descrição — o Google escreve o próprio resumo na listagem',
    },
    {
      key: 'h1',
      label: 'Exatamente um H1',
      weight: 4,
      applicable: true,
      passed: facts.h1Texts.length === 1,
      evidence: `${facts.h1Texts.length} elemento(s) <h1>`,
      weakness:
        facts.h1Texts.length === 0
          ? 'Sem título H1, então a página não declara seu assunto'
          : `${facts.h1Texts.length} títulos H1 disputando o assunto da página`,
    },
    {
      key: 'cta',
      label: 'Chamada para ação clara',
      weight: 10,
      applicable: true,
      passed: facts.hasCtaButton,
      evidence: facts.ctaEvidence ?? 'nenhum texto reconhecível de chamada para ação encontrado',
      weakness: 'Sem chamada para ação clara — nada diz ao visitante o que fazer em seguida',
    },
    {
      key: 'phone',
      label: 'Telefone na página',
      weight: 6,
      applicable: true,
      passed: facts.phones.length > 0,
      evidence: facts.phones.length ? `${facts.phones.length} telefone(s) encontrado(s)` : 'nenhum telefone encontrado',
      weakness: 'Sem telefone na página inicial',
    },
    {
      key: 'contact_route',
      label: 'Alguma forma de contato',
      weight: 6,
      applicable: true,
      passed: hasContactRoute,
      evidence: [
        facts.hasContactForm ? 'formulário de contato' : null,
        facts.emails.length ? 'endereço de e-mail' : null,
        facts.phones.length ? 'telefone' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'nenhum formulário, e-mail ou telefone encontrado',
      weakness: 'Sem formulário, e-mail nem telefone na página inicial',
    },
    {
      key: 'booking',
      label: 'Agendamento on-line',
      weight: 8,
      applicable: bookingExpected,
      passed: facts.hasBookingSignal,
      evidence: facts.bookingEvidence ?? 'nenhum link ou texto de agendamento encontrado',
      weakness: 'Sem agendamento on-line, que o cliente deste setor espera encontrar',
    },
    {
      key: 'whatsapp',
      label: 'Contato por WhatsApp',
      weight: 2,
      applicable: true,
      passed: facts.hasWhatsApp,
      evidence: facts.hasWhatsApp ? 'link wa.me ou do WhatsApp encontrado' : 'nenhum link do WhatsApp',
      weakness: 'Sem opção de WhatsApp para uma dúvida rápida',
    },
    {
      key: 'map',
      label: 'Mapa ou localização incorporada',
      weight: 4,
      applicable: true,
      passed: facts.hasMap,
      evidence: facts.hasMap ? 'mapa incorporado ou link de mapas encontrado' : 'nenhum mapa ou link de mapas',
      weakness: 'Sem mapa, então o cliente não vê onde a empresa fica',
    },
    {
      key: 'service_pages',
      label: 'Páginas de serviços',
      weight: 8,
      applicable: true,
      passed: facts.servicePages.length >= 2,
      evidence: facts.servicePages.length
        ? `${facts.servicePages.length} link(s) de página de serviço: ${facts.servicePages.slice(0, 3).join(', ')}`
        : 'nenhuma página de serviço ligada a partir da inicial',
      weakness: 'Sem páginas por serviço — uma única página tem que ranquear para tudo',
    },
    {
      key: 'location_pages',
      label: 'Páginas por localidade',
      weight: 4,
      applicable: true,
      passed: facts.locationPages.length >= 1,
      evidence: facts.locationPages.length
        ? `${facts.locationPages.length} link(s) de página por localidade`
        : 'nenhuma página por localidade ou área atendida',
      weakness: 'Sem páginas por localidade, que a busca local valoriza',
    },
    {
      key: 'testimonials',
      label: 'Avaliações ou depoimentos',
      weight: 5,
      applicable: true,
      passed: facts.hasTestimonials,
      evidence: facts.testimonialEvidence ?? 'nenhuma seção de depoimento ou avaliação encontrada',
      weakness: 'Nenhuma avaliação ou depoimento exibido',
    },
    {
      key: 'trust',
      label: 'Certificações ou garantias',
      weight: 4,
      applicable: true,
      passed: facts.hasTrustSignals,
      evidence: facts.trustEvidence ?? 'nenhum texto de certificação ou garantia encontrado',
      weakness: 'Sem certificações, garantias ou referências a órgãos reguladores',
    },
    {
      key: 'privacy',
      label: 'Política de privacidade',
      weight: 4,
      applicable: true,
      passed: facts.hasPrivacyPage,
      evidence: facts.hasPrivacyPage ? 'link de política de privacidade encontrado' : 'nenhum link de política de privacidade',
      weakness: 'Sem link de política de privacidade — exigido pela LGPD em um site que recebe contatos',
    },
    {
      key: 'cookies',
      label: 'Aviso de cookies',
      weight: 2,
      applicable: true,
      passed: facts.hasCookieNotice,
      evidence: facts.hasCookieNotice ? 'texto de consentimento de cookies encontrado' : 'nenhum texto de consentimento de cookies',
      weakness: 'Sem aviso de cookies',
    },
    {
      key: 'speed',
      label: 'Respondeu rápido',
      weight: 6,
      applicable: ctx.responseTimeMs !== undefined,
      passed: (ctx.responseTimeMs ?? 0) < SLOW_MS,
      evidence:
        ctx.responseTimeMs !== undefined
          ? `a página inicial respondeu em ${ctx.responseTimeMs}ms`
          : 'tempo de resposta não medido',
      weakness: `Demora a responder (${ctx.responseTimeMs}ms na página inicial)`,
    },
    {
      key: 'modern_markup',
      label: 'Sem marcação obsoleta',
      weight: 4,
      applicable: true,
      passed: facts.outdatedHints.length === 0,
      evidence: facts.outdatedHints.length
        ? `marcação obsoleta encontrada: ${facts.outdatedHints.join(', ')}`
        : 'nenhuma marcação obsoleta encontrada',
      weakness: `Construção datada — ${facts.outdatedHints.join(', ')}`,
    },
    {
      key: 'image_alt',
      label: 'Imagens com texto alternativo',
      weight: 4,
      applicable: facts.totalImages > 0,
      passed: facts.totalImages > 0 && facts.imagesMissingAlt / facts.totalImages <= 0.25,
      evidence: `${facts.imagesMissingAlt} de ${facts.totalImages} imagens sem texto alternativo`,
      weakness: `${facts.imagesMissingAlt} de ${facts.totalImages} imagens sem texto alternativo (acessibilidade)`,
    },
    {
      key: 'lang',
      label: 'Idioma declarado',
      weight: 2,
      applicable: true,
      passed: !!facts.lang,
      evidence: facts.lang ? `<html lang="${facts.lang}">` : 'sem atributo lang no <html>',
      weakness: 'Sem atributo de idioma no <html> (acessibilidade)',
    },
    {
      key: 'social',
      label: 'Links para redes sociais',
      weight: 3,
      applicable: true,
      passed: facts.socialLinks.length > 0,
      evidence: facts.socialLinks.length
        ? `links para ${facts.socialLinks.map((s) => s.platform).join(', ')}`
        : 'nenhum link para redes sociais',
      weakness: 'Sem links para redes sociais',
    },
    {
      key: 'links_work',
      label: 'Links testados funcionam',
      weight: 3,
      applicable: (ctx.checkedLinkCount ?? 0) > 0,
      passed: (ctx.brokenLinkCount ?? 0) === 0,
      evidence:
        (ctx.checkedLinkCount ?? 0) > 0
          ? `${ctx.brokenLinkCount ?? 0} de ${ctx.checkedLinkCount} links testados falharam`
          : 'nenhum link testado',
      weakness: `${ctx.brokenLinkCount} de ${ctx.checkedLinkCount} links testados estão quebrados`,
    },
  ];

  const applicable = checks.filter((c) => c.applicable);
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  const earned = applicable.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  const weaknesses = applicable
    .filter((c) => !c.passed && c.weakness)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.weakness!);

  const strengths = applicable
    .filter((c) => c.passed)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.label);

  return { score, checks, weaknesses, strengths };
}

/** Bands used by the search filters and the lead card. */
export type WebsiteQualityBand = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'VERY_WEAK';

export function qualityBand(score: number): WebsiteQualityBand {
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'ADEQUATE';
  if (score >= 35) return 'WEAK';
  return 'VERY_WEAK';
}
