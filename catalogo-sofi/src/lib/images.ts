import { STORAGE_BUCKET, supabaseUrl } from "./env";

/**
 * image_path guarda o caminho dentro do bucket ("produtos/uuid.webp").
 * Os dados iniciais podem usar arquivos de /public ("/sofi/x.webp") ou URLs completas.
 */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("https://") || path.startsWith("/")) return path;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

export function isStoragePath(path: string | null | undefined): path is string {
  return !!path && !path.startsWith("https://") && !path.startsWith("/");
}
