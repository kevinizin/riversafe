import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { demoCategories, demoProducts, demoSettings } from "@/lib/demo-data";
import { hasBlobStore, localStoreDir } from "@/lib/env";
import type { Category, Product, StoreSettings } from "@/lib/types";

/**
 * Armazenamento do catálogo.
 * Tudo fica num Blob PRIVADO (só o servidor lê e escreve com o token):
 *   data/catalog.json   configurações, categorias e produtos
 *   data/auth.json      usuário e senha (hash) do painel, quando trocada
 *   media/...           fotos enviadas pelo painel
 */

export type CatalogDoc = {
  /** Aumenta a cada gravação; serve para saber qual cópia é a mais nova. */
  rev?: number;
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
};

const CATALOG = "data/catalog.json";

function seed(): CatalogDoc {
  return structuredClone({
    settings: demoSettings,
    categories: demoCategories,
    products: demoProducts,
  });
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

// --------------------------------------------------------------------------
// Operações básicas (Blob em produção, pasta local em testes)
// --------------------------------------------------------------------------

export async function readFile(pathname: string): Promise<{ data: Buffer; etag: string | null } | null> {
  if (hasBlobStore) {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    // O get() devolve o ETag no formato "fraco" (W/"..."); o put(ifMatch) espera
    // o mesmo hash sem o prefixo.
    const etag = res.blob.etag ? res.blob.etag.replace(/^W\//, "") : null;
    return { data: await streamToBuffer(res.stream), etag };
  }
  try {
    const data = await fs.readFile(path.join(localStoreDir, pathname));
    return { data, etag: null };
  } catch {
    return null;
  }
}

export async function writeFile(
  pathname: string,
  body: Buffer | string,
  contentType: string,
  ifMatch?: string | null,
): Promise<string | null> {
  if (hasBlobStore) {
    const result = await put(pathname, body, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: pathname.startsWith("media/") ? 31536000 : 60,
      ...(ifMatch ? { ifMatch } : {}),
    });
    return result.etag;
  }
  const full = path.join(localStoreDir, pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
  return null;
}

export async function deleteFile(pathname: string) {
  if (hasBlobStore) {
    await del(pathname).catch((err) => console.error(`Falha ao apagar ${pathname}`, err));
    return;
  }
  await fs.rm(path.join(localStoreDir, pathname), { force: true });
}

// --------------------------------------------------------------------------
// Catálogo
// --------------------------------------------------------------------------

// O Blob pode levar alguns instantes para devolver o que acabou de ser gravado.
// Guardamos a última versão gravada por esta instância e usamos a mais nova
// (pelo número de revisão), assim o painel mostra a alteração na hora.
let lastWrite: { doc: CatalogDoc; etag: string | null } | null = null;

export async function readCatalog(): Promise<{ doc: CatalogDoc; etag: string | null }> {
  const file = await readFile(CATALOG);
  const stored = file
    ? { doc: JSON.parse(file.data.toString("utf8")) as CatalogDoc, etag: file.etag }
    : null;
  if (lastWrite && (lastWrite.doc.rev ?? 0) > (stored?.doc.rev ?? -1)) {
    return { doc: structuredClone(lastWrite.doc), etag: lastWrite.etag };
  }
  return stored ?? { doc: seed(), etag: null };
}

/**
 * Lê, altera e grava o catálogo. Usa o ETag para não sobrescrever uma
 * alteração feita ao mesmo tempo em outro aparelho (tenta de novo uma vez).
 */
export async function mutateCatalog<T>(change: (doc: CatalogDoc) => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { doc, etag } = await readCatalog();
    const result = change(doc);
    doc.rev = (doc.rev ?? 0) + 1;
    try {
      const newEtag = await writeFile(CATALOG, JSON.stringify(doc), "application/json", etag);
      lastWrite = { doc: structuredClone(doc), etag: newEtag };
      return result;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError && attempt < 2) continue;
      throw err;
    }
  }
}
