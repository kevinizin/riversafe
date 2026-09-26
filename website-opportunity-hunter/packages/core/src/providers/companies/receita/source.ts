/**
 * Finding out what the Receita is offering, behind whichever protocol the
 * place it is offered from happens to speak.
 *
 * For years that was a plain HTTP directory index. It is now a Nextcloud
 * public share ("SERPRO+"), and the old address answers 404 — in a browser as
 * well as from code. Both are supported rather than one replacing the other:
 * `--url` can point at either, so an operator with a mirror, or one running
 * this the next time the Receita moves, is not stuck waiting on a release.
 *
 * None of this could be verified against the real host, which refuses
 * connections from outside Brazil — the TLS handshake completes and the
 * server then closes without answering. So the shapes here come from the
 * documented Nextcloud endpoints and are exercised against a local server in
 * source.test.ts, and every failure path says what it tried and what it got
 * back, because the only person who can see the real thing is the operator.
 */

import {
  RECEITA_HEADERS,
  filesFromNames,
  foldersFromNames,
  parseDavListing,
  parseShareLink,
  shareAuthHeader,
  shareDavRoots,
  type ShareLink,
} from './download.js';

export interface Source {
  /** Entry names directly under a path relative to the root. */
  list(path: string): Promise<string[]>;
  /** The URL a file at that path is downloaded from. */
  fileUrl(path: string): string;
  /** Headers each download needs — a share's Authorization lives here. */
  headers: Record<string, string>;
  /** How this source was reached, for the "where did this come from" line. */
  describe: string;
}

export interface OpenSourceOptions {
  fetchImpl?: typeof fetch;
}

/** Raised when a listing cannot be read, carrying what to tell the operator. */
export class SourceUnreachableError extends Error {}

const PROPFIND_BODY =
  '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>';

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

/**
 * A plain HTTP directory index.
 *
 * Folder and file names come from the same set of hrefs, so one request
 * answers one listing and the caller filters.
 */
export function htmlSource(baseUrl: string, options: OpenSourceOptions = {}): Source {
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = baseUrl.replace(/\/+$/, '');

  return {
    describe: root,
    headers: {},
    fileUrl: (path) => `${root}/${encodePath(path)}`,
    list: async (path) => {
      const url = path ? `${root}/${encodePath(path)}/` : `${root}/`;
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: RECEITA_HEADERS });
      } catch (cause) {
        throw new SourceUnreachableError(
          `Não consegui nem conectar em ${url}.\n` +
            `  Causa técnica: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
      if (!response.ok) {
        throw new SourceUnreachableError(
          `Não consegui ler a listagem em ${url} (HTTP ${response.status}).`,
        );
      }
      const html = await response.text();
      return [...hrefNames(html)];
    },
  };
}

/** Entry names from a directory index, keeping the slash that marks a folder. */
function hrefNames(html: string): string[] {
  return [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => {
    const href = match[1]!;
    const trailing = /\/$/.test(href) ? '/' : '';
    return `${href.replace(/\/+$/, '').split('/').pop() ?? ''}${trailing}`;
  });
}

/**
 * A Nextcloud public share, over its WebDAV endpoint.
 *
 * Not the share's web page: that page is a JavaScript application, and the
 * listing it renders comes from exactly this endpoint. Going straight to it
 * is both simpler and the only way to get Range requests, which is what makes
 * an interrupted download resume instead of starting over.
 *
 * Which WebDAV root answers depends on the server's version, so both
 * documented ones are tried and the one that answers is kept.
 */
export async function openShare(
  share: ShareLink,
  options: OpenSourceOptions = {},
): Promise<Source> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authorization = shareAuthHeader(share.token);
  const headers = {
    ...RECEITA_HEADERS,
    authorization,
    depth: '1',
    'content-type': 'application/xml',
  };

  const failures: string[] = [];

  for (const root of shareDavRoots(share)) {
    let response: Response;
    try {
      response = await fetchImpl(`${root}/`, { method: 'PROPFIND', headers, body: PROPFIND_BODY });
    } catch (cause) {
      failures.push(`${root} — ${cause instanceof Error ? cause.message : String(cause)}`);
      continue;
    }
    if (!response.ok) {
      failures.push(`${root} — HTTP ${response.status}`);
      continue;
    }

    const base = new URL(root).pathname;
    const first = parseDavListing(await response.text(), base);

    return {
      describe: `${root} (compartilhamento ${share.token})`,
      headers: { authorization },
      fileUrl: (path) => `${root}/${encodePath(path)}`,
      list: async (path) => {
        // The root listing is already in hand from the probe above; asking for
        // it again would be a second request for an answer we have.
        if (!path) return first;

        const url = `${root}/${encodePath(path)}/`;
        const listing = await fetchImpl(url, {
          method: 'PROPFIND',
          headers,
          body: PROPFIND_BODY,
        });
        if (!listing.ok) {
          throw new SourceUnreachableError(
            `Não consegui listar "${path}" no compartilhamento (HTTP ${listing.status}).`,
          );
        }
        return parseDavListing(await listing.text(), `${base}/${path}`);
      },
    };
  }

  throw new SourceUnreachableError(
    `O compartilhamento ${share.origin}/index.php/s/${share.token} não respondeu em\n` +
      `  nenhum dos endereços WebDAV conhecidos:\n` +
      failures.map((failure) => `    ${failure}`).join('\n') +
      `\n\n  Abra o link no navegador. Se a lista de arquivos aparecer lá, o endereço está\n` +
      `  certo e foi a forma de acesso que mudou — me mande a tela.`,
  );
}

/** Opens whichever kind of source the address turns out to be. */
export async function openSource(
  baseUrl: string,
  options: OpenSourceOptions = {},
): Promise<Source> {
  const share = parseShareLink(baseUrl);
  return share ? openShare(share, options) : htmlSource(baseUrl, options);
}

/** The monthly extraction folders a source offers, newest last. */
export async function listMonths(source: Source): Promise<string[]> {
  return foldersFromNames(await source.list(''));
}

/** The archives a monthly folder offers. */
export async function listArchives(source: Source, month: string): Promise<string[]> {
  return filesFromNames(await source.list(month));
}
