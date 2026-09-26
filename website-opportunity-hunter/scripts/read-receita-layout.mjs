#!/usr/bin/env node
/**
 * Reads the Receita's CNPJ layout PDF as text.
 *
 *   npm run layout:br
 *   npm run layout:br -- ./algum-outro.pdf
 *
 * Exists because that PDF cannot be read by ordinary means: its fonts are
 * subset Type1 with no ToUnicode mapping, so every text extractor returns
 * control characters. For a long time this project therefore declared the CSV
 * column order as UNVERIFIED, with a warning that someone would eventually
 * have to sit down with the PDF and check thirty columns by eye.
 *
 * They do not. The fonts' /Encoding carries a /Differences array naming each
 * glyph (/C /N /Atilde /ccedilla …), so character code → glyph name →
 * character is a lookup. That is what this does, with no dependencies: zlib
 * to inflate the streams and regular expressions for the rest, because a PDF
 * parser is a large thing to add for one file read once a year.
 *
 * Run it when the Receita publishes a new layout, and compare the output
 * against layout.ts — that comparison is the whole point of keeping it.
 */

import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';

const SOURCE = 'https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf';

/** Glyph names that are not simply their own character. */
const NAMED = {
  space: ' ', period: '.', comma: ',', slash: '/', hyphen: '-', colon: ':',
  semicolon: ';', parenleft: '(', parenright: ')', quoteleft: '‘',
  quoteright: '’', quotedbl: '"', endash: '–', emdash: '—',
  section: '§', underscore: '_', asterisk: '*', percent: '%', plus: '+',
  equal: '=', question: '?', exclam: '!', bracketleft: '[', bracketright: ']',
  bullet: '•', degree: '°', numbersign: '#',
  ordmasculine: 'º', ordfeminine: 'ª',
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

/** Combining marks, so Aacute and ccedilla need no table of their own. */
const ACCENTS = {
  acute: '́', grave: '̀', tilde: '̃',
  circumflex: '̂', cedilla: '̧', dieresis: '̈',
};

function glyphToChar(name) {
  if (name in NAMED) return NAMED[name];
  if (name.length === 1) return name;
  for (const [suffix, mark] of Object.entries(ACCENTS)) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      const base = name.slice(0, -suffix.length);
      if (base.length === 1) return (base + mark).normalize('NFC');
    }
  }
  return '';
}

/** Every `N 0 obj … endobj` body, by object number. */
function readObjects(pdf) {
  const objects = new Map();
  const pattern = /(\d+)\s+0\s+obj\r?\n?([\s\S]*?)endobj/g;
  for (const match of pdf.toString('latin1').matchAll(pattern)) {
    objects.set(Number(match[1]), match[2]);
  }
  return objects;
}

/** A font's character code → character, from its /Differences array. */
function encodingOf(body) {
  const differences = /\/Differences\s*\[([\s\S]*?)\]/.exec(body);
  if (!differences) return new Map();

  const map = new Map();
  let code = 0;
  for (const token of differences[1].matchAll(/(\d+)|\/([^\s/[\]]+)/g)) {
    if (token[1] !== undefined) code = Number(token[1]);
    else map.set(code++, glyphToChar(token[2]));
  }
  return map;
}

/** The inflated body of an object's stream, or undefined. */
function streamOf(body) {
  const match = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body);
  if (!match) return undefined;
  const raw = Buffer.from(match[1], 'latin1');
  try {
    return inflateSync(raw).toString('latin1');
  } catch {
    return raw.toString('latin1');
  }
}

/**
 * The page's font resources for a content stream.
 *
 * Follows the two indirections a real PDF uses: /Contents is usually an array
 * of streams, and /Font usually a reference rather than an inline dictionary.
 */
function fontResourcesFor(objects, contentNumber) {
  for (const body of objects.values()) {
    const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(body);
    if (!contents) continue;
    if (!new RegExp(`\\b${contentNumber}\\s+0\\s+R`).test(contents[1])) continue;

    const inline = /\/Font\s*<<([\s\S]*?)>>/.exec(body);
    const reference = /\/Font\s+(\d+)\s+0\s+R/.exec(body);
    const block = inline ? inline[1] : reference ? (objects.get(Number(reference[1])) ?? '') : '';

    const resources = new Map();
    for (const entry of block.matchAll(/\/([A-Za-z0-9_]+)\s+(\d+)\s+0\s+R/g)) {
      resources.set(entry[1], Number(entry[2]));
    }
    return resources;
  }
  return new Map();
}

/** PDF string escapes: \\n, \\( and the octal form. */
function unescapeString(raw) {
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '\\' || i + 1 >= raw.length) {
      out.push(raw.charCodeAt(i));
      continue;
    }
    const next = raw[i + 1];
    if (next >= '0' && next <= '7') {
      const octal = /^[0-7]{1,3}/.exec(raw.slice(i + 1))[0];
      out.push(parseInt(octal, 8));
      i += octal.length;
      continue;
    }
    out.push({ n: 10, r: 13, t: 9 }[next] ?? next.charCodeAt(0));
    i += 1;
  }
  return out;
}

export function extractText(pdf) {
  const objects = readObjects(pdf);

  const fonts = new Map();
  for (const [number, body] of objects) {
    if (!body.includes('/Type/Font') && !body.includes('/Type /Font')) continue;
    const reference = /\/Encoding\s+(\d+)\s+0\s+R/.exec(body);
    if (reference && objects.has(Number(reference[1]))) {
      fonts.set(number, encodingOf(objects.get(Number(reference[1]))));
    }
  }

  const pieces = [];
  for (const [number, body] of [...objects].sort((a, b) => a[0] - b[0])) {
    const content = streamOf(body);
    if (!content || (!content.includes('Tj') && !content.includes('TJ'))) continue;

    const resources = fontResourcesFor(objects, number);
    let encoding = new Map();
    let line = [];
    const lines = [];

    // Font selection, a literal string, or one of the operators that ends a line.
    const tokens = /\/([A-Za-z0-9_]+)\s+[\d.]+\s+Tf|\((?:\\[\s\S]|[^\\()])*\)|(TD|Td|T\*|ET)/g;
    for (const token of content.matchAll(tokens)) {
      if (token[1] !== undefined) {
        encoding = fonts.get(resources.get(token[1])) ?? new Map();
      } else if (token[2] !== undefined) {
        if (line.length) lines.push(line.join(''));
        line = [];
      } else {
        for (const code of unescapeString(token[0].slice(1, -1))) {
          line.push(encoding.get(code) ?? '');
        }
      }
    }
    if (line.length) lines.push(line.join(''));
    pieces.push(lines.join('\n'));
  }

  return pieces.join('\n');
}

const path = argv[2];
if (!path) {
  console.error(
    `Uso: npm run layout:br -- <arquivo.pdf>\n\n` +
      `  Baixe o layout oficial primeiro:\n    ${SOURCE}\n`,
  );
  process.exit(1);
}

const text = extractText(readFileSync(path));
const lines = text
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

if (!lines.length) {
  console.error(
    `Nenhum texto extraído de ${path}.\n\n` +
      `  Se a Receita passou a publicar o PDF com outro tipo de fonte, este\n` +
      `  extrator precisa ser revisto — ele depende de fontes Type1 com\n` +
      `  /Differences nomeando os glifos.`,
  );
  process.exit(2);
}

console.log(lines.join('\n'));
