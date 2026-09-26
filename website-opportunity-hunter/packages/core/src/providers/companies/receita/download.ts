/**
 * Downloading the Receita Federal monthly files.
 *
 * Deliberately not routed through `HttpClient`, which every other outbound call
 * in this project uses. That client caps the response body to protect against a
 * hostile or broken server, which is exactly right for an API and exactly wrong
 * for a 2 GB archive. This writes to disk as the bytes arrive and never holds
 * the file in memory.
 *
 * Three things shape the rest of it:
 *
 *  - The transfer takes long enough that it *will* be interrupted. Every file
 *    resumes from what is already on disk with a Range request, so a dropped
 *    connection costs the current chunk rather than the whole download.
 *  - The host rate-limits. Files are fetched one at a time; a parallel fetch
 *    would finish sooner right up until it starts getting refused.
 *  - A truncated file that looks finished is the failure that matters here,
 *    because the importer downstream cannot tell a short file from a small
 *    one. Every download is checked against the length the server declared,
 *    and a mismatch is an error rather than a warning.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Where the Receita publishes the CNPJ open data.
 *
 * This was a plain directory listing at
 * `/dados/cnpj/dados_abertos_cnpj/` until the files moved to a Nextcloud
 * instance ("SERPRO+"), at which point that address started answering 404 —
 * in a browser as well as here. A public share link is what the dataset page
 * hands out now.
 *
 * It is the one thing in this project that depends on a third party keeping
 * an address, which is why it is a lone constant and why `--url` overrides it.
 * When it moves again, that is a one-line change.
 */
export const RECEITA_BASE_URL = 'https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9';

/**
 * Headers every request here carries.
 *
 * Node's fetch sends no User-Agent at all, and a fair number of public-sector
 * servers answer such a request with a 404 or a 403 — which reads, wrongly,
 * as the file having moved. So the client names itself honestly: this is not
 * pretending to be a browser, which would be working around a block rather
 * than being a well-behaved client. The Accept header is there for the same
 * reason: the listing is a plain HTML index, and a request that asks for
 * nothing in particular is the one most likely to be refused.
 */
export const RECEITA_HEADERS: Record<string, string> = {
  'user-agent': 'Azven/0.1 (open-data client; contact via the repository)',
  accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9',
};

/**
 * The files one monthly extraction is made of.
 *
 * Ten numbered parts each for the two big tables, plus the municipality
 * lookup. The part count is not published as a manifest anywhere, so it is
 * written out here and confirmed against what the folder listing actually
 * contains before anything is downloaded.
 */
export function monthlyFiles(parts = 10): string[] {
  return [
    ...Array.from({ length: parts }, (_, i) => `Empresas${i}.zip`),
    ...Array.from({ length: parts }, (_, i) => `Estabelecimentos${i}.zip`),
    'Municipios.zip',
  ];
}

/**
 * A Nextcloud public share, split into the parts its WebDAV endpoint needs.
 *
 * Returns undefined for anything that is not a share link, which is how the
 * caller decides between the two protocols rather than by guessing.
 */
export interface ShareLink {
  origin: string;
  token: string;
}

export function parseShareLink(url: string): ShareLink | undefined {
  const match = /^(https?:\/\/[^/]+)\/(?:index\.php\/)?s\/([A-Za-z0-9_-]+)\/?$/.exec(url.trim());
  return match ? { origin: match[1]!, token: match[2]! } : undefined;
}

/**
 * A public share authenticates as the share token with an empty password.
 *
 * That is the documented scheme for these links, not a way around a login:
 * the share is public, and the token is the whole of the credential — the
 * same token that is already in the URL.
 */
export function shareAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

/**
 * The WebDAV roots a public share answers on, likeliest first.
 *
 * Nextcloud moved public shares from `/public.php/webdav` to
 * `/public.php/dav/files/<token>`, and which one a given instance serves
 * depends on its version. Rather than pin a guess, both are tried and the
 * one that answers is used.
 */
export function shareDavRoots(share: ShareLink): string[] {
  return [
    `${share.origin}/public.php/dav/files/${share.token}`,
    `${share.origin}/public.php/webdav`,
  ];
}

/**
 * The direct children named by a PROPFIND response.
 *
 * Collections come back with a trailing slash, which is what tells a monthly
 * folder from a file. The namespace prefix on `href` varies between servers
 * (`d:`, `D:`, none), so the element is matched by local name.
 */
export function parseDavListing(xml: string, basePath: string): string[] {
  const base = `/${basePath.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/+/, '/');
  const names = new Set<string>();

  for (const match of xml.matchAll(/<[\w-]*:?href\s*>([^<]*)<\/[\w-]*:?href\s*>/gi)) {
    let href: string;
    try {
      href = decodeURIComponent(match[1]!.trim());
    } catch {
      // A malformed percent-escape is not worth failing the whole listing for.
      continue;
    }
    // Servers answer with either an absolute path or a full URL.
    const path = /^https?:\/\//i.test(href) ? new URL(href).pathname : href;
    if (!path.startsWith(base)) continue;

    const rest = path.slice(base.length);
    if (!rest) continue; // the collection being listed, not a child of it

    const parts = rest.split('/');
    const first = parts[0];
    if (!first) continue;
    names.add(parts.length > 1 && parts[1] === '' ? `${first}/` : first);
  }

  return [...names];
}

/** The monthly extraction folders among a set of entry names, newest last. */
export function foldersFromNames(names: string[]): string[] {
  const folders = new Set<string>();
  for (const name of names) {
    const folder = /^(\d{4}-\d{2}-\d{2})\/?$/.exec(name)?.[1];
    if (folder) folders.add(folder);
  }
  return [...folders].sort();
}

/** The archives among a set of entry names. */
export function filesFromNames(names: string[]): string[] {
  return [...new Set(names.filter((name) => /\.zip$/i.test(name)))];
}

/**
 * The monthly extraction folders, newest last.
 *
 * The index is a plain directory listing, so this reads the hrefs rather than
 * trying to parse the surrounding HTML. Anything that is not a `YYYY-MM-DD`
 * folder is ignored, which keeps a redesign of the page from being read as a
 * list of nonexistent months.
 */
export function parseFolderListing(html: string): string[] {
  return foldersFromNames(
    [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => {
      const href = match[1]!;
      // Keep the trailing slash a directory link carries: it is what the name
      // filters use to tell a folder from a file.
      const trailing = /\/$/.test(href) ? '/' : '';
      return `${href.replace(/\/+$/, '').split('/').pop() ?? ''}${trailing}`;
    }),
  );
}

/** The file names a folder listing actually offers. */
export function parseFileListing(html: string): string[] {
  return filesFromNames(
    [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1]!.split('/').pop() ?? '',
    ),
  );
}

export interface DownloadProgress {
  file: string;
  /** Bytes on disk, including anything a previous attempt left there. */
  received: number;
  /** Total the server declared, or undefined when it declared none. */
  total?: number;
  resumed: boolean;
}

export interface DownloadOptions {
  fetchImpl?: typeof fetch;
  /** Merged over the default headers — the share's Authorization goes here. */
  headers?: Record<string, string>;
  /** Called as bytes arrive, at most a few times a second. */
  onProgress?: (progress: DownloadProgress) => void;
  /** How many times to retry a transfer that dies mid-stream. */
  maxAttempts?: number;
  /** Overridable so the tests do not sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DownloadOutcome {
  file: string;
  bytes: number;
  /** True when the file was already complete and nothing was transferred. */
  skipped: boolean;
  resumed: boolean;
  attempts: number;
}

const PROGRESS_INTERVAL_MS = 250;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Bytes already on disk, or 0 when there is nothing there. */
async function existingBytes(path: string): Promise<number> {
  try {
    const info = await stat(path);
    return info.isFile() ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Downloads one file, resuming whatever a previous attempt left behind.
 *
 * Returns without transferring anything when the file on disk already matches
 * the length the server declares, which is what makes re-running the command
 * after an interruption cheap.
 */
export async function downloadFile(
  url: string,
  destination: string,
  options: DownloadOptions = {},
): Promise<DownloadOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? 5;
  const sleep = options.sleep ?? defaultSleep;
  const name = destination.split(/[\\/]/).pop() ?? destination;

  await mkdir(dirname(destination), { recursive: true });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const from = await existingBytes(destination);

    try {
      const response = await fetchImpl(url, {
        headers: {
          ...RECEITA_HEADERS,
          ...options.headers,
          ...(from > 0 ? { range: `bytes=${from}-` } : {}),
        },
      });

      // 416 means the range starts past the end of the file, which for a
      // resume means what is on disk is already the whole thing.
      if (response.status === 416) {
        return { file: name, bytes: from, skipped: true, resumed: false, attempts: attempt };
      }

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }

      // A server that ignores the Range header answers 200 with the whole file.
      // Restarting is the only correct response: appending would corrupt it.
      const resumed = from > 0 && response.status === 206;
      const start = resumed ? from : 0;

      const declared = Number(response.headers.get('content-length') ?? '');
      const total = Number.isFinite(declared) && declared > 0 ? start + declared : undefined;

      if (total !== undefined && start === total) {
        return { file: name, bytes: total, skipped: true, resumed: false, attempts: attempt };
      }

      if (!response.body) throw new Error(`no response body for ${url}`);

      let received = start;
      let lastReport = 0;
      const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      source.on('data', (chunk: Buffer) => {
        received += chunk.length;
        const now = Date.now();
        if (now - lastReport >= PROGRESS_INTERVAL_MS) {
          lastReport = now;
          options.onProgress?.({ file: name, received, ...(total !== undefined ? { total } : {}), resumed });
        }
      });

      // `pipeline` destroys the destination when the source fails, which can
      // discard bytes it still had buffered. That costs a few kilobytes on the
      // next attempt and nothing else: the resume offset is read back off the
      // file each time rather than tracked in memory, so a short write makes
      // the next request start slightly earlier and never corrupts anything.
      await pipeline(source, createWriteStream(destination, { flags: resumed ? 'a' : 'w' }));

      const onDisk = await existingBytes(destination);
      if (total !== undefined && onDisk !== total) {
        // The stream ended early. Throwing sends this back round the retry
        // loop, which resumes from the bytes that did arrive.
        throw new Error(
          `${name} is ${onDisk} bytes but the server declared ${total}; the transfer ended early`,
        );
      }

      options.onProgress?.({ file: name, received: onDisk, ...(total !== undefined ? { total } : {}), resumed });
      return { file: name, bytes: onDisk, skipped: false, resumed, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        // Full jitter, same shape as the rest of the project's backoff, and
        // capped: this is a download that may already have run for an hour.
        const capped = Math.min(30_000, 500 * 2 ** (attempt - 1));
        await sleep(Math.random() * capped);
      }
    }
  }

  throw new Error(
    `Could not download ${name} after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
