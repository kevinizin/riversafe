import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  downloadFile,
  monthlyFiles,
  parseFileListing,
  parseFolderListing,
} from './download.js';

/**
 * These run against a real HTTP server on localhost rather than a mocked
 * fetch, because the behaviour worth testing is the protocol: Range requests,
 * a stream that dies mid-file, a server that ignores the range header. A mock
 * would only prove that the mock does what I told it to.
 *
 * What they cannot cover is the Receita's own server, which refuses
 * connections from outside Brazil. See DATA_SOURCES.md.
 */

const dir = mkdtempSync(join(tmpdir(), 'receita-dl-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** 64 KB of deterministic bytes, big enough to arrive in several chunks. */
const PAYLOAD = Buffer.from(
  Array.from({ length: 64 * 1024 }, (_, i) => i % 251),
);

let server: Server;
let base: string;

/** Set per test to steer the handler. */
let mode: 'whole' | 'die-halfway' | 'ignore-range' | 'no-length' = 'whole';
let requests: { range: string | undefined }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({ range: req.headers.range });

    if (req.url === '/listing') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(
        `<html><body>
           <a href="../">../</a>
           <a href="2026-08-16/">2026-08-16/</a>
           <a href="2026-09-14/">2026-09-14/</a>
           <a href="/dados/cnpj/dados_abertos_cnpj/2025-12-14/">older</a>
           <a href="regimetributario/">regimetributario/</a>
         </body></html>`,
      );
      return;
    }

    if (req.url === '/files') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(
        `<a href="Empresas0.zip">Empresas0.zip</a>
         <a href="Estabelecimentos0.zip">Estabelecimentos0.zip</a>
         <a href="Municipios.zip">Municipios.zip</a>
         <a href="LEIAME.txt">LEIAME.txt</a>`,
      );
      return;
    }

    const rangeHeader = req.headers.range;
    const start = rangeHeader ? Number(/bytes=(\d+)-/.exec(rangeHeader)?.[1] ?? 0) : 0;

    if (mode === 'ignore-range') {
      res.writeHead(200, { 'content-length': String(PAYLOAD.length) });
      res.end(PAYLOAD);
      return;
    }

    if (start >= PAYLOAD.length) {
      res.writeHead(416, { 'content-range': `bytes */${PAYLOAD.length}` });
      res.end();
      return;
    }

    const body = PAYLOAD.subarray(start);

    if (mode === 'no-length') {
      res.writeHead(start > 0 ? 206 : 200, {});
      res.end(body);
      return;
    }

    res.writeHead(start > 0 ? 206 : 200, { 'content-length': String(body.length) });

    if (mode === 'die-halfway') {
      // Send half, then hang up without finishing — what a dropped connection
      // looks like, and the case the resume logic exists for.
      //
      // The destroy waits for the write to flush. Destroying the socket in the
      // same tick throws the buffered bytes away before they reach the client,
      // which makes every attempt resume from zero and the test prove nothing.
      res.write(body.subarray(0, Math.floor(body.length / 2)), () => {
        setTimeout(() => res.destroy(), 20);
      });
      return;
    }

    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const noSleep = async () => {};

describe('monthlyFiles', () => {
  it('names the 21 files an extraction is made of', () => {
    const files = monthlyFiles();
    expect(files).toHaveLength(21);
    expect(files).toContain('Empresas0.zip');
    expect(files).toContain('Estabelecimentos9.zip');
    expect(files).toContain('Municipios.zip');
  });
});

describe('parseFolderListing', () => {
  it('finds the monthly folders, newest last', async () => {
    const html = await fetch(`${base}/listing`).then((r) => r.text());
    expect(parseFolderListing(html)).toEqual(['2025-12-14', '2026-08-16', '2026-09-14']);
  });

  it('ignores anything that is not a dated folder', () => {
    // A redesigned page must not be read as a list of months that do not exist.
    expect(parseFolderListing('<a href="regimetributario/">x</a><a href="/">/</a>')).toEqual([]);
  });
});

describe('parseFileListing', () => {
  it('lists only the archives', async () => {
    const html = await fetch(`${base}/files`).then((r) => r.text());
    expect(parseFileListing(html).sort()).toEqual([
      'Empresas0.zip',
      'Estabelecimentos0.zip',
      'Municipios.zip',
    ]);
  });
});

describe('downloadFile', () => {
  it('downloads a whole file', async () => {
    mode = 'whole';
    const path = join(dir, 'whole.zip');
    const result = await downloadFile(`${base}/f.zip`, path, { sleep: noSleep });

    expect(result.bytes).toBe(PAYLOAD.length);
    expect(result.skipped).toBe(false);
    expect(readFileSync(path).equals(PAYLOAD)).toBe(true);
  });

  it('resumes after the connection drops, and the bytes come out identical', async () => {
    mode = 'die-halfway';
    const path = join(dir, 'resumed.zip');

    // First attempt dies halfway; the retry resumes from what landed. The
    // handler keeps dying, so this needs enough attempts to converge.
    mode = 'die-halfway';
    let attempts = 0;
    const flaky: typeof fetch = async (input, init) => {
      attempts += 1;
      // Let the third attempt through intact, as a flaky link eventually does.
      if (attempts >= 3) mode = 'whole';
      return fetch(input as string, init);
    };

    const result = await downloadFile(`${base}/f.zip`, path, { fetchImpl: flaky, sleep: noSleep });

    expect(result.bytes).toBe(PAYLOAD.length);
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.resumed).toBe(true);
    // The whole point: a resumed file is byte-for-byte the original.
    expect(readFileSync(path).equals(PAYLOAD)).toBe(true);
  });

  it('does nothing when the file on disk is already complete', async () => {
    mode = 'whole';
    const path = join(dir, 'complete.zip');
    writeFileSync(path, PAYLOAD);

    const result = await downloadFile(`${base}/f.zip`, path, { sleep: noSleep });
    expect(result.skipped).toBe(true);
    expect(result.bytes).toBe(PAYLOAD.length);
  });

  it('restarts rather than appending when the server ignores the range', async () => {
    mode = 'ignore-range';
    const path = join(dir, 'ignored.zip');
    // Half a file from a previous attempt.
    writeFileSync(path, PAYLOAD.subarray(0, 1000));

    const result = await downloadFile(`${base}/f.zip`, path, { sleep: noSleep });

    expect(result.resumed).toBe(false);
    // Appending to the partial file would have produced 1000 bytes too many.
    expect(result.bytes).toBe(PAYLOAD.length);
    expect(readFileSync(path).equals(PAYLOAD)).toBe(true);
  });

  it('accepts a server that declares no length, since there is nothing to check against', async () => {
    mode = 'no-length';
    const path = join(dir, 'nolength.zip');
    const result = await downloadFile(`${base}/f.zip`, path, { sleep: noSleep });
    expect(result.bytes).toBe(PAYLOAD.length);
  });

  it('gives up with a named error rather than leaving a short file behind', async () => {
    mode = 'die-halfway';
    const path = join(dir, 'doomed.zip');

    await expect(
      downloadFile(`${base}/f.zip`, path, { sleep: noSleep, maxAttempts: 2 }),
    ).rejects.toThrow(/doomed\.zip/);
  });

  it('reports progress as the bytes arrive', async () => {
    mode = 'whole';
    const path = join(dir, 'progress.zip');
    const seen: number[] = [];

    await downloadFile(`${base}/f.zip`, path, {
      sleep: noSleep,
      onProgress: (p) => seen.push(p.received),
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(PAYLOAD.length);
  });

  it('sends a range header only when there is something to resume', async () => {
    mode = 'whole';
    requests = [];
    await downloadFile(`${base}/f.zip`, join(dir, 'fresh.zip'), { sleep: noSleep });
    expect(requests.at(-1)?.range).toBeUndefined();

    writeFileSync(join(dir, 'partial.zip'), PAYLOAD.subarray(0, 100));
    requests = [];
    await downloadFile(`${base}/f.zip`, join(dir, 'partial.zip'), { sleep: noSleep });
    expect(requests.at(-1)?.range).toBe('bytes=100-');
  });
});
