/**
 * Onde os dados ficam guardados:
 * - Vercel Blob (produção): o token é injetado pela Vercel ao conectar o Blob ao projeto.
 * - Pasta local (testes): defina LOCAL_STORE_DIR=./.data
 * Sem nenhum dos dois o catálogo mostra os dados iniciais e o painel fica desligado.
 */
export const hasBlobStore = !!process.env.BLOB_READ_WRITE_TOKEN;
export const localStoreDir = process.env.LOCAL_STORE_DIR ?? "";
export const isDemoMode = !hasBlobStore && !localStoreDir;
