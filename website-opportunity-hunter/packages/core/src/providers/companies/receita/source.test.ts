import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDavListing, parseShareLink, shareAuthHeader } from './download.js';
import { SourceUnreachableError, listArchives, listMonths, openSource } from './source.js';

/**
 * A stand-in Nextcloud, because the real one cannot be reached from here: the
 * Receita's host completes the TLS handshake and then closes without
 * answering anything that is not a Brazilian connection.
 *
 * So this asserts the half that is ours — that the right method, credential
 * and path go out, and that what comes back is read correctly. What it cannot
 * assert is that the Receita's instance behaves like this one; the failure
 * paths are written to report what they tried, so the operator's screen
 * answers that question when it comes up.
 */

const TOKEN = 'YggdBLfdninEJX9';

let server: Server;
let base: string;
/** Which WebDAV root this fake serves; the other one 404s. */
let davRoot: 'modern' | 'legacy' = 'modern';
let requests: { method: string; url: string; depth?: string; auth?: string }[] = [];

function multistatus(href: string, children: { name: string; collection: boolean }[]): string {
  const entry = (path: string, collection: boolean) => `
    <d:response>
      <d:href>${path}</d:href>
      <d:propstat><d:prop><d:resourcetype>${
        collection ? '<d:collection/>' : ''
      }</d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
    </d:response>`;

  return `<?xml version="1.0"?>
  <d:multistatus xmlns:d="DAV:">
    ${entry(href, true)}
    ${children
      .map((child) =>
        entry(`${href}${encodeURIComponent(child.name)}${child.collection ? '/' : ''}`, child.collection),
      )
      .join('')}
  </d:multistatus>`;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? '';
    requests.push({
      method: req.method ?? '',
      url,
      depth: req.headers.depth as string | undefined,
      auth: req.headers.authorization,
    });

    const modern = `/public.php/dav/files/${TOKEN}`;
    const legacy = '/public.php/webdav';
    const root = davRoot === 'modern' ? modern : legacy;

    if (req.method === 'PROPFIND') {
      // The root that is not in use answers as it would if it were gone.
      if (!url.startsWith(root)) {
        res.writeHead(404).end();
        return;
      }
      // A public share still authenticates: the token is the credential.
      if (req.headers.authorization !== shareAuthHeader(TOKEN)) {
        res.writeHead(401).end();
        return;
      }

      res.writeHead(207, { 'content-type': 'application/xml' });
      if (url === `${root}/`) {
        res.end(
          multistatus(`${root}/`, [
            { name: '2026-08-16', collection: true },
            { name: '2026-09-14', collection: true },
            { name: 'LEIAME.txt', collection: false },
          ]),
        );
        return;
      }
      res.end(
        multistatus(`${root}/2026-09-14/`, [
          { name: 'Empresas0.zip', collection: false },
          { name: 'Estabelecimentos0.zip', collection: false },
          { name: 'Municipios.zip', collection: false },
          { name: 'LEIAME.txt', collection: false },
        ]),
      );
      return;
    }

    if (url === '/indice/' || url === '/indice/2026-09-14/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(
        url === '/indice/'
          ? `<a href="2026-08-16/">x</a><a href="2026-09-14/">y</a>`
          : `<a href="Empresas0.zip">a</a><a href="Municipios.zip">b</a>`,
      );
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('parseShareLink', () => {
  it('recognises the share link the Receita hands out', () => {
    expect(parseShareLink(`https://arquivos.receitafederal.gov.br/index.php/s/${TOKEN}`)).toEqual({
      origin: 'https://arquivos.receitafederal.gov.br',
      token: TOKEN,
    });
  });

  it('accepts the short form and a trailing slash', () => {
    expect(parseShareLink(`https://host.example/s/${TOKEN}/`)?.token).toBe(TOKEN);
  });

  it('is undefined for a plain directory URL, which picks the other protocol', () => {
    expect(parseShareLink('https://host.example/dados/cnpj/dados_abertos_cnpj')).toBeUndefined();
  });
});

describe('shareAuthHeader', () => {
  it('sends the token as the user with an empty password', () => {
    // The documented scheme for a public share. The token is already in the
    // URL; this is not a credential being guessed at.
    expect(shareAuthHeader('abc')).toBe(`Basic ${Buffer.from('abc:').toString('base64')}`);
  });
});

describe('parseDavListing', () => {
  const xml = multistatus('/public.php/dav/files/T/', [
    { name: '2026-09-14', collection: true },
    { name: 'Municipios.zip', collection: false },
  ]);

  it('returns the children and marks folders with a slash', () => {
    expect(parseDavListing(xml, '/public.php/dav/files/T').sort()).toEqual([
      '2026-09-14/',
      'Municipios.zip',
    ]);
  });

  it('leaves out the collection being listed', () => {
    // Otherwise the folder would appear inside itself and be downloaded.
    expect(parseDavListing(xml, '/public.php/dav/files/T')).not.toContain('T/');
  });

  it('decodes percent-escapes, since a name can carry a space', () => {
    const escaped = multistatus('/dav/', [{ name: 'Dados Abertos.zip', collection: false }]);
    expect(parseDavListing(escaped, '/dav')).toEqual(['Dados Abertos.zip']);
  });

  it('reads an href given as a full URL, which some servers send', () => {
    const absolute = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>https://host.example/dav/</d:href></d:response>
      <d:response><d:href>https://host.example/dav/Empresas0.zip</d:href></d:response>
    </d:multistatus>`;
    expect(parseDavListing(absolute, '/dav')).toEqual(['Empresas0.zip']);
  });

  it('ignores entries outside the folder being listed', () => {
    const stray = `<d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/somewhere/else/Empresas9.zip</d:href></d:response>
    </d:multistatus>`;
    expect(parseDavListing(stray, '/dav')).toEqual([]);
  });
});

describe('openSource against a share', () => {
  it('lists the monthly folders and the archives inside one', async () => {
    davRoot = 'modern';
    const source = await openSource(`${base}/index.php/s/${TOKEN}`);

    expect(await listMonths(source)).toEqual(['2026-08-16', '2026-09-14']);
    // LEIAME.txt is offered and is not an archive.
    expect((await listArchives(source, '2026-09-14')).sort()).toEqual([
      'Empresas0.zip',
      'Estabelecimentos0.zip',
      'Municipios.zip',
    ]);
  });

  it('asks with PROPFIND, depth 1 and the share credential', async () => {
    davRoot = 'modern';
    requests = [];
    await listMonths(await openSource(`${base}/index.php/s/${TOKEN}`));

    const propfind = requests.filter((r) => r.method === 'PROPFIND');
    expect(propfind.length).toBeGreaterThan(0);
    expect(propfind.every((r) => r.depth === '1')).toBe(true);
    expect(propfind.every((r) => r.auth === shareAuthHeader(TOKEN))).toBe(true);
  });

  it('does not ask twice for the listing it already has', async () => {
    // Opening the share has to read the root to know it answered; asking for
    // it again would be a second request for an answer already in hand.
    davRoot = 'modern';
    requests = [];
    const source = await openSource(`${base}/index.php/s/${TOKEN}`);
    await listMonths(source);
    await listMonths(source);
    expect(requests.filter((r) => r.method === 'PROPFIND')).toHaveLength(1);
  });

  it('falls back to the legacy WebDAV root when the modern one is gone', async () => {
    // Which one a Nextcloud serves depends on its version, so both are tried.
    davRoot = 'legacy';
    requests = [];
    const source = await openSource(`${base}/index.php/s/${TOKEN}`);

    expect(await listMonths(source)).toEqual(['2026-08-16', '2026-09-14']);
    expect(requests[0]?.url).toContain('/public.php/dav/files/');
    expect(requests[1]?.url).toContain('/public.php/webdav');
  });

  it('builds a file URL under the root that answered', async () => {
    davRoot = 'modern';
    const source = await openSource(`${base}/index.php/s/${TOKEN}`);
    expect(source.fileUrl('2026-09-14/Empresas0.zip')).toBe(
      `${base}/public.php/dav/files/${TOKEN}/2026-09-14/Empresas0.zip`,
    );
  });

  it('carries the credential into the download headers', async () => {
    davRoot = 'modern';
    const source = await openSource(`${base}/index.php/s/${TOKEN}`);
    expect(source.headers.authorization).toBe(shareAuthHeader(TOKEN));
  });

  it('names every root it tried when none answers', async () => {
    // The operator is the only one who can see the real server, so the error
    // has to hand them something to compare against.
    const dead = `${base.replace(/:\d+$/, ':9')}/index.php/s/${TOKEN}`;
    await expect(openSource(dead)).rejects.toThrow(SourceUnreachableError);
    await expect(openSource(dead)).rejects.toThrow(/public\.php\/dav\/files[\s\S]*public\.php\/webdav/);
  });
});

describe('openSource against a directory index', () => {
  it('still reads a plain listing, so --url can point at a mirror', async () => {
    const source = await openSource(`${base}/indice`);
    expect(await listMonths(source)).toEqual(['2026-08-16', '2026-09-14']);
    expect((await listArchives(source, '2026-09-14')).sort()).toEqual([
      'Empresas0.zip',
      'Municipios.zip',
    ]);
  });

  it('reports the status rather than a bare failure', async () => {
    await expect(openSource(`${base}/nada`).then((s) => s.list(''))).rejects.toThrow(/HTTP 404/);
  });
});
