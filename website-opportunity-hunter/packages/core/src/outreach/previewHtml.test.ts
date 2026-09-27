import { describe, expect, it } from 'vitest';
import { buildOutreachFacts } from './facts.js';
import { buildPreviewBriefing } from './preview.js';
import { esc, renderPreviewHtml } from './previewHtml.js';

const NOW = new Date('2026-09-01T00:00:00Z');

const briefing = (over: Parameters<typeof buildPreviewBriefing>[0] extends infer T ? Partial<T> : never = {}) =>
  buildPreviewBriefing({
    companyName: 'Demo Dental Studio Ltd',
    industryKey: 'dental',
    city: 'Manchester',
    countryName: 'United Kingdom',
    currency: 'GBP',
    language: 'pt-BR',
    facts: buildOutreachFacts({
      companyName: 'Demo Dental Studio Ltd',
      city: 'Manchester',
      incorporationDate: new Date('2026-08-28T00:00:00Z'),
      industryKey: 'dental',
      websiteStatus: 'NO_WEBSITE_FOUND',
      reviewCount: 127,
      rating: 4.9,
      now: NOW,
    }),
    brandColourHints: ['#1f6feb', '#0b2e6f'],
    reviewCount: 127,
    rating: 4.9,
    now: NOW,
    ...over,
  });

const html = () => renderPreviewHtml(briefing(), { preparedBy: 'Alex', preparedByBusiness: 'Studio' });

describe('renderPreviewHtml', () => {
  it('produces a complete standalone document', () => {
    const output = html();
    expect(output.startsWith('<!doctype html>')).toBe(true);
    expect(output).toContain('</html>');
    expect(output).toContain('Demo Dental Studio Ltd');
  });

  it('cannot be mistaken for the business own site', () => {
    const output = html();
    expect(output).toContain('Prévia conceitual');
    expect(output).toContain('Não tem vínculo com a');
    expect(output).toContain('preparada por Alex, Studio');
  });

  it('keeps itself out of search results', () => {
    expect(html()).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it('makes no external request and runs no script', () => {
    const output = html();
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toMatch(/https?:\/\//);
    expect(output).not.toMatch(/<link[^>]+href/i);
  });

  it('uses the detected brand colours', () => {
    expect(html()).toContain('--accent: #1f6feb');
  });

  it('marks sector-suggested services as unconfirmed', () => {
    const output = html();
    expect(output).toContain('Sugerido para o setor — confirme antes de usar.');
  });

  it('shows a confirmed review count as fact, not as a placeholder', () => {
    const output = html();
    // Stated in the business's own voice, but still only the fact we hold.
    expect(output).toMatch(/<h3>Avaliações<\/h3><p>Temos 127 avaliações, com nota 4\.9/);
  });

  it('leaves review space empty rather than inventing numbers', () => {
    const withoutReviews = renderPreviewHtml(
      buildPreviewBriefing({
        companyName: 'Demo Ltd',
        countryName: 'United Kingdom',
        currency: 'GBP',
        language: 'pt-BR',
        facts: [],
        reviewCount: null,
        now: NOW,
      }),
      { preparedBy: 'Alex' },
    );
    expect(withoutReviews).toContain('Espaço para avaliações assim que a empresa fornecer.');
    expect(withoutReviews).not.toMatch(/\d+ reviews/);
  });

  it('never asserts accreditations', () => {
    expect(html()).toContain('Em branco até a empresa fornecer.');
  });

  it('lists what must be confirmed before the page is shown to anyone', () => {
    const output = html();
    expect(output).toContain('Antes de mostrar isto a alguém');
    expect(output).toContain('Horário de funcionamento');
  });
});

describe('esc', () => {
  it('escapes every character that could break out of markup', () => {
    expect(esc(`<script>alert("x")&'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;');
  });

  it('is applied to the company name', () => {
    const output = renderPreviewHtml(
      buildPreviewBriefing({
        companyName: '<img src=x onerror=alert(1)> Ltd',
        countryName: 'United Kingdom',
        currency: 'GBP',
        language: 'pt-BR',
        facts: [],
        now: NOW,
      }),
      { preparedBy: 'Alex' },
    );
    expect(output).not.toContain('<img src=x');
    expect(output).toContain('&lt;img src=x onerror=alert(1)&gt; Ltd');
  });
});

describe('briefings stored before notes carried a confirmed flag', () => {
  it('renders them as placeholders rather than printing undefined', () => {
    const current = briefing();
    // Exactly what an older row looks like coming back out of the database.
    const legacy = {
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        contentNotes: section.contentNotes.map((note) => note.text),
      })),
    } as unknown as typeof current;

    const output = renderPreviewHtml(legacy, { preparedBy: 'Alex' });
    expect(output).not.toContain('undefined');
    // Unconfirmed is the safe reading of an unknown shape, so contact details
    // come through marked as placeholders.
    expect(output).toContain('class="ph"');
  });
});
