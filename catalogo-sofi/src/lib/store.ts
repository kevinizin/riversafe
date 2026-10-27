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
    return { data: await streamToBuffer(res.stream), etag: res.blob.etag };
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
) {
  if (hasBlobStore) {
    await put(pathname, body, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: pathname.startsWith("media/") ? 31536000 : 60,
      ...(ifMatch ? { ifMatch } : {}),
    });
    return;
  }
  const full = path.join(localStoreDir, pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function deleteFile(pathname: string) {
  if (hasBlobStore) {
    await del(pathname).catch(() => {});
    return;
  }
  await fs.rm(path.join(localStoreDir, pathname), { force: true });
}

// --------------------------------------------------------------------------
// Catálogo
// --------------------------------------------------------------------------

export async function readCatalog(): Promise<{ doc: CatalogDoc; etag: string | null }> {
  const file = await readFile(CATALOG);
  if (!file) return { doc: seed(), etag: null };
  return { doc: JSON.parse(file.data.toString("utf8")) as CatalogDoc, etag: file.etag };
}

/**
 * Lê, altera e grava o catálogo. Usa o ETag para não sobrescrever uma
 * alteração feita ao mesmo tempo em outro aparelho (tenta de novo uma vez).
 */
export async function mutateCatalog<T>(change: (doc: CatalogDoc) => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { doc, etag } = await readCatalog();
    const result = change(doc);
    try {
      await writeFile(CATALOG, JSON.stringify(doc), "application/json", etag);
      return result;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError && attempt === 0) continue;
      throw err;
    }
  }
}
