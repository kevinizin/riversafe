/**
 * Reading the Receita Federal files: zip entries and semicolon CSV.
 *
 * Both are done by hand rather than with a library, for one reason: these files
 * are big enough that the whole job has to stream. A helper that hands back an
 * array of rows would need the entire Estabelecimentos table in memory, and
 * the Amazonas filter — the thing that makes this import tractable at all —
 * only works if rows can be discarded as they go past.
 */

import { createReadStream } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';

// --- CSV ---------------------------------------------------------------------

/**
 * Parses one line of the register's CSV dialect.
 *
 * Semicolon-separated, optionally double-quoted, with `""` as an escaped quote
 * inside a quoted field. No header row.
 *
 * Note what this does *not* handle: a newline inside a quoted field. The row
 * splitting upstream is line-based, so such a row would arrive here already
 * broken. That is a deliberate limit rather than an oversight — these are
 * registry fields, not free text — and the layout check catches the damage as a
 * column-count mismatch rather than letting it through.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ';') {
      out.push(field);
      field = '';
    } else field += ch;
  }

  out.push(field);
  return out;
}

/**
 * Streams the rows of a Latin-1, semicolon-separated file.
 *
 * The decoding matters: these files are ISO-8859-1, and reading them as UTF-8
 * turns every accented company name into replacement characters — silently, and
 * only visibly once a lead card shows "CONSTRU��O".
 */
export async function* csvRows(source: Readable): AsyncGenerator<string[]> {
  const decoder = new TextDecoder('latin1');
  let carry = '';

  for await (const chunk of source) {
    carry += decoder.decode(chunk as Buffer, { stream: true });
    let newline = carry.indexOf('\n');
    while (newline >= 0) {
      const line = carry.slice(0, newline).replace(/\r$/, '');
      carry = carry.slice(newline + 1);
      if (line.length) yield parseCsvLine(line);
      newline = carry.indexOf('\n');
    }
  }

  carry += decoder.decode();
  const last = carry.replace(/\r$/, '');
  if (last.length) yield parseCsvLine(last);
}

// --- Zip ---------------------------------------------------------------------

const LOCAL_FILE_HEADER = 0x04034b50;
const FLAG_DATA_DESCRIPTOR = 0x08;

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. Nothing else is supported. */
  method: number;
  /** Byte offset of the entry's data within the file. */
  dataOffset: number;
  compressedSize: number;
  uncompressedSize: number;
}

/**
 * Lists a zip's entries by walking the local file headers.
 *
 * This reads forwards from the start rather than seeking to the central
 * directory, which is the more usual approach. Forwards is correct here because
 * these archives hold a single large member and the first header is at byte
 * zero, and it avoids the ZIP64 end-of-central-directory handling that a
 * multi-gigabyte archive would otherwise force.
 */
export async function listZipEntries(path: string): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const handle = await import('node:fs/promises').then((fs) => fs.open(path, 'r'));

  try {
    let offset = 0;
    for (;;) {
      const header = Buffer.alloc(30);
      const { bytesRead } = await handle.read(header, 0, 30, offset);
      if (bytesRead < 30 || header.readUInt32LE(0) !== LOCAL_FILE_HEADER) break;

      const flags = header.readUInt16LE(6);
      const method = header.readUInt16LE(8);
      const compressedSize = header.readUInt32LE(18);
      const uncompressedSize = header.readUInt32LE(22);
      const nameLength = header.readUInt16LE(26);
      const extraLength = header.readUInt16LE(28);

      const nameBuffer = Buffer.alloc(nameLength);
      await handle.read(nameBuffer, 0, nameLength, offset + 30);
      const name = nameBuffer.toString('utf8');
      const dataOffset = offset + 30 + nameLength + extraLength;

      entries.push({ name, method, dataOffset, compressedSize, uncompressedSize });

      // A data descriptor means the sizes in the header are zero and the real
      // ones follow the data. Walking forward past such an entry would mean
      // scanning for the descriptor signature, which can appear inside
      // compressed data — so stop rather than risk misreading the next entry.
      if (flags & FLAG_DATA_DESCRIPTOR || compressedSize === 0) break;

      offset = dataOffset + compressedSize;
    }
  } finally {
    await handle.close();
  }

  return entries;
}

/**
 * A readable stream of one zip entry's decompressed bytes.
 *
 * Only `stored` and `deflate` are supported. Anything else throws by name
 * rather than producing garbage, because a silently mis-decompressed CSV would
 * reach the layout check as a column-count error and send whoever is debugging
 * it looking in entirely the wrong place.
 */
export function openZipEntry(path: string, entry: ZipEntry): Readable {
  const raw = createReadStream(path, {
    start: entry.dataOffset,
    end: entry.dataOffset + entry.compressedSize - 1,
  });

  if (entry.method === 0) return raw;
  if (entry.method === 8) return raw.pipe(createInflateRaw());

  throw new Error(
    `Zip entry "${entry.name}" uses compression method ${entry.method}; only stored (0) and deflate (8) are supported.`,
  );
}

/**
 * Rows of a CSV, whether it is inside a zip or sitting on disk as a plain file.
 *
 * Accepting both is not a convenience: a multi-gigabyte member takes a long
 * time to inflate, and anyone iterating on an import wants to unzip once and
 * then re-run against the extracted file.
 */
export async function* rowsOfFile(path: string): AsyncGenerator<string[]> {
  if (path.toLowerCase().endsWith('.zip')) {
    const entries = await listZipEntries(path);
    const entry = entries[0];
    if (!entry) throw new Error(`No entries found in ${path}.`);
    yield* csvRows(openZipEntry(path, entry));
    return;
  }

  yield* csvRows(createReadStream(path));
}
