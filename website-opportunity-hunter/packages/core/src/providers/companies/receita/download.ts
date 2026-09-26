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

/** Where the Receita publishes the CNPJ open data. */
export const RECEITA_BASE_URL = 'https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj';

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
 * The monthly extraction folders, newest last.
 *
 * The index is a plain directory listing, so this reads the hrefs rather than
 * trying to parse the surrounding HTML. Anything that is not a `YYYY-MM-DD`
 * folder is ignored, which keeps a redesign of the page from being read as a
 * list of nonexistent months.
 */
export function parseFolderListing(html: string): string[] {
  const folders = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1]!;
    const name = /(\d{4}-\d{2}-\d{2})\/?$/.exec(href.replace(/\/+$/, '/'))?.[1];
    if (name) folders.add(name);
  }
  return [...folders].sort();
}

/** The file names a folder listing actually offers. */
export function parseFileListing(html: string): string[] {
  const files = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const name = match[1]!.split('/').pop();
    if (name && /\.zip$/i.test(name)) files.add(name);
  }
  return [...files];
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
        headers: from > 0 ? { range: `bytes=${from}-` } : {},
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
