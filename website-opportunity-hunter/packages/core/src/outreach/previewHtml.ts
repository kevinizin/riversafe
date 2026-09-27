import { normaliseNote, toFirstPersonVoice } from './preview.js';
import type { BriefingNote, PreviewBriefing } from './preview.js';

export interface PreviewHtmlOptions {
  /** Who prepared the concept. Named on the page so it cannot pass as official. */
  preparedBy: string;
  /** Optional business name of the person preparing it. */
  preparedByBusiness?: string;
}

const DEFAULT_ACCENT = '#1f6feb';
const DEFAULT_INK = '#0f1720';

/**
 * Renders a demonstration homepage from a preview briefing.
 *
 * This is a sales aid, not a website, and the output is built so it cannot be
 * mistaken for one:
 *
 *  - a banner at the top of the document names it a concept and names who
 *    prepared it, so it never reads as something the business commissioned;
 *  - `noindex, nofollow`, so a copy left on a server does not compete with the
 *    business's own pages in search;
 *  - anything not backed by a confirmed fact is rendered as a visibly marked
 *    placeholder rather than as a claim;
 *  - no scripts, no external requests, no tracking. It is one self-contained
 *    file that opens offline.
 *
 * It is never published anywhere by this system. The operator downloads it and
 * decides what to do with it.
 */
export function renderPreviewHtml(briefing: PreviewBriefing, options: PreviewHtmlOptions): string {
  const name = briefing.business.name;
  const accent = briefing.brand.colourHints[0] ?? DEFAULT_ACCENT;
  const accentSoft = briefing.brand.colourHints[1] ?? accent;
  const location = briefing.business.location;
  const industry = briefing.business.industry;

  const confirmed = new Map(briefing.confirmed.map((c) => [c.label, c.value]));
  const preparer = options.preparedByBusiness
    ? `${options.preparedBy}, ${options.preparedByBusiness}`
    : options.preparedBy;

  const services = briefing.suggestedServices.slice(0, 6);
  const contactSection = briefing.sections.find((s) => s.key === 'contact');
  const trustSection = briefing.sections.find((s) => s.key === 'trust');

  return `<!doctype html>
<html lang="${esc(briefing.business.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Prévia conceitual — ${esc(name)}</title>
<style>
  :root {
    --accent: ${esc(accent)};
    --accent-soft: ${esc(accentSoft)};
    --ink: ${DEFAULT_INK};
    --muted: #5b6875;
    --line: #e2e8f0;
    --paper: #ffffff;
    --wash: #f6f8fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: var(--paper);
  }
  .concept-banner {
    background: #1f2933; color: #fff; padding: .7rem 1rem; font-size: .8rem; line-height: 1.5;
  }
  .concept-banner strong { color: #ffd479; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 1.25rem; }
  header.site { border-bottom: 1px solid var(--line); padding: 1rem 0; }
  header.site .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
  .logo { font-weight: 700; font-size: 1.05rem; letter-spacing: -.01em; }
  nav { margin-left: auto; display: flex; flex-wrap: wrap; gap: 1rem; font-size: .9rem; }
  nav span { color: var(--muted); }
  .cta {
    display: inline-block; background: var(--accent); color: #fff; text-decoration: none;
    padding: .7rem 1.15rem; border-radius: .5rem; font-weight: 600; font-size: .95rem;
  }
  .hero { padding: 3.5rem 0; background: var(--wash); border-bottom: 1px solid var(--line); }
  .hero h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.15; margin: 0 0 .75rem; letter-spacing: -.02em; }
  .hero p.lead { font-size: 1.1rem; color: var(--muted); margin: 0 0 1.5rem; max-width: 46ch; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
  .ghost {
    display: inline-block; border: 1px solid var(--line); background: #fff; color: var(--ink);
    text-decoration: none; padding: .7rem 1.15rem; border-radius: .5rem; font-weight: 600; font-size: .95rem;
  }
  section { padding: 3rem 0; border-bottom: 1px solid var(--line); }
  h2 { font-size: 1.4rem; margin: 0 0 1.25rem; letter-spacing: -.01em; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .card { border: 1px solid var(--line); border-radius: .6rem; padding: 1.1rem; background: #fff; }
  .card h3 { margin: 0 0 .4rem; font-size: 1.02rem; }
  .card p { margin: 0; color: var(--muted); font-size: .93rem; }
  .ph {
    background: #fff8e1; border-bottom: 1px dashed #d9a400; padding: 0 .15rem; border-radius: 2px;
  }
  .ph-note { font-size: .78rem; color: #8a6d00; display: block; margin-top: .5rem; }
  .split { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .map {
    background: repeating-linear-gradient(45deg, var(--wash), var(--wash) 12px, #eef2f6 12px, #eef2f6 24px);
    border: 1px solid var(--line); border-radius: .6rem; min-height: 200px;
    display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: .9rem;
  }
  .band { background: var(--accent); color: #fff; }
  .band h2, .band p { color: #fff; }
  .band .cta { background: #fff; color: var(--accent); }
  dl.contact { margin: 0; }
  dl.contact dt { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-top: .9rem; }
  dl.contact dd { margin: .15rem 0 0; }
  footer.site { padding: 2rem 0; font-size: .85rem; color: var(--muted); }
  .legend { font-size: .82rem; color: var(--muted); padding: 1.5rem 0 2.5rem; }
  .legend code { background: var(--wash); padding: .05rem .3rem; border-radius: 3px; }
</style>
</head>
<body>

<div class="concept-banner">
  <div class="wrap">
    <strong>Prévia conceitual.</strong>
    Esta página foi preparada por ${esc(preparer)} como uma ideia de design não solicitada para
    ${esc(name)}. Não tem vínculo com a ${esc(name)}, não foi aprovada nem encomendada por ela, e
    não é um site no ar. O texto destacado é um preenchimento provisório que não foi confirmado
    com a empresa.
  </div>
</div>

<header class="site">
  <div class="wrap">
    <span class="logo">${esc(name)}</span>
    <nav>
      ${services.slice(0, 3).map((s) => `<span>${esc(s.name)}</span>`).join('\n      ')}
      <span>Contato</span>
    </nav>
    <a class="cta" href="#contact">${esc(briefing.primaryCta)}</a>
  </div>
</header>

<div class="hero">
  <div class="wrap">
    <h1>${esc(headline(industry, location))}</h1>
    <p class="lead">
      <span class="ph">${esc(strapline(industry, location))}</span>
    </p>
    <div class="hero-actions">
      <a class="cta" href="#contact">${esc(briefing.primaryCta)}</a>
      <a class="ghost" href="#services">Veja o que fazemos</a>
    </div>
    <span class="ph-note">O título e a linha de apoio são rascunhos — confirme o texto com a empresa.</span>
  </div>
</div>

<section id="services">
  <div class="wrap">
    <h2>Serviços</h2>
    <div class="grid">
      ${services
        .map(
          (service) => `<div class="card">
        <h3>${esc(service.name)}</h3>
        <p>${
          service.status === 'OBSERVED_ON_WEBSITE'
            ? 'Retirado do site atual.'
            : '<span class="ph">Sugerido para o setor — confirme antes de usar.</span>'
        }</p>
      </div>`,
        )
        .join('\n      ')}
    </div>
    <span class="ph-note">Cada serviço vira uma página própria, para poder ranquear por conta própria.</span>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Por que a ${esc(name)}</h2>
    <div class="grid">
      ${trustCards(confirmed, notesOf(trustSection), name)}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2>${esc(briefing.primaryCta)}</h2>
    <p>${esc(ctaSupport(location))}</p>
    <p><a class="cta" href="#contact">${esc(briefing.primaryCta)}</a></p>
  </div>
</section>

<section id="contact">
  <div class="wrap">
    <div class="split">
      <div>
        <h2>Contato</h2>
        <dl class="contact">
          ${contactRows(notesOf(contactSection))}
        </dl>
      </div>
      <div>
        <h2>Como chegar</h2>
        <div class="map">${location ? `Mapa de ${esc(location)}` : 'Mapa — endereço a confirmar'}</div>
        <span class="ph-note">
          ${location ? `Localização registrada: ${esc(location)}. Confirme o endereço de operação.` : 'Endereço de operação a confirmar com a empresa.'}
        </span>
      </div>
    </div>
  </div>
</section>

<footer class="site">
  <div class="wrap">
    <p>${esc(name)} — design conceitual. ${esc(briefing.business.country)} · ${esc(briefing.business.currency)}</p>
    <div class="legend">
      <p><strong>Observações para quem revisar isto</strong></p>
      <p>O texto marcado com <code class="ph">um sublinhado tracejado</code> é um preenchimento
      provisório que não foi confirmado com a empresa. Antes de mostrar isto a alguém:</p>
      <ul>
        ${briefing.toConfirm.map((item) => `<li>${esc(item)}</li>`).join('\n        ')}
      </ul>
      <p>${briefing.constraints.map(esc).join(' ')}</p>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

function headline(industry: string, location: string | null): string {
  const what = industry === 'Unclassified' ? 'Serviços locais' : industry;
  return location ? `${what} em ${location}` : what;
}

function strapline(industry: string, location: string | null): string {
  const where = location ? ` em ${location}` : '';
  return `Uma linha curta descrevendo o que a empresa oferece em ${industry.toLowerCase()}${where}, e para quem.`;
}

function ctaSupport(location: string | null): string {
  return location
    ? `Conte o que você precisa e retornamos no mesmo dia útil — atendemos ${location} e região.`
    : 'Conte o que você precisa e retornamos no mesmo dia útil.';
}

/**
 * The briefing states facts about the business in the third person
 * ("Demo Ltd have 127 reviews"). A homepage speaks as the business, so the
 * subject is swapped for "We" — a rewording of the same fact, not a new claim.
 */
function toFirstPerson(value: string, companyName: string): string {
  // The briefing says "A Demo Ltda tem 127 avaliações"; a homepage speaks as
  // the business, so it becomes "Temos 127 avaliações". Same fact, same
  // numbers, different voice — and the verb has to agree, which is why this
  // goes through the shared table rather than swapping the subject.
  const first = toFirstPersonVoice(value, companyName);
  return first === value ? capitalise(value) : first;
}

/** Trust cards built from confirmed facts first, placeholders only to fill. */
/**
 * A section's notes, in the current shape.
 *
 * Briefings generated before notes carried a `confirmed` flag were stored as
 * plain strings, and those rows are still in the database. Passing them
 * straight through would read `note.text` off a string and render "undefined"
 * on a page meant for a prospect, so they are normalised — and treated as
 * unconfirmed, which errs towards marking something as a placeholder.
 */
function notesOf(section: { contentNotes?: (BriefingNote | string)[] } | undefined): BriefingNote[] {
  return (section?.contentNotes ?? []).map(normaliseNote);
}

function trustCards(confirmed: Map<string, string>, notes: BriefingNote[], companyName: string): string {
  const cards: string[] = [];

  const reviews = confirmed.get('reviews');
  if (reviews) {
    cards.push(`<div class="card"><h3>Avaliações</h3><p>${esc(toFirstPerson(reviews, companyName))}</p></div>`);
  } else {
    cards.push(
      '<div class="card"><h3>Avaliações</h3><p><span class="ph">Espaço para avaliações assim que a empresa fornecer.</span></p></div>',
    );
  }

  const incorporation = confirmed.get('recent incorporation');
  if (incorporation) {
    cards.push(
      `<div class="card"><h3>No mercado</h3><p>${esc(toFirstPerson(incorporation, companyName))}</p></div>`,
    );
  }

  cards.push(
    '<div class="card"><h3>Certificações</h3><p><span class="ph">Em branco até a empresa fornecer.</span></p></div>',
  );

  // Matched by key, not by sniffing the text for an English word. The previous
  // version looked for a note starting with "Photographs", which would have
  // stopped matching the moment the briefing was written in another language.
  const extra = notes.find((n) => !n.confirmed && /fotograf/i.test(n.text));
  if (extra) {
    cards.push(`<div class="card"><h3>Fotografia</h3><p><span class="ph">${esc(extra.text)}</span></p></div>`);
  }

  return cards.join('\n      ');
}

function contactRows(notes: BriefingNote[]): string {
  return notes
    .map((note) => {
      const [label, ...rest] = note.text.split(':');
      const value = rest.join(':').trim();
      // The note says whether it is confirmed. This used to be guessed by
      // testing the text against /to be supplied|confirm|supplies/, which meant
      // a translated briefing would have rendered every placeholder as if it
      // were an established fact.
      const unknown = !note.confirmed || !value;
      return `<dt>${esc((label ?? 'Detalhe').trim())}</dt><dd>${
        unknown ? `<span class="ph">${esc(value || note.text)}</span>` : esc(value)
      }</dd>`;
    })
    .join('\n          ');
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Escapes text for HTML. Every interpolation in this file goes through it. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
