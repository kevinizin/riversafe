/**
 * image_path guarda um caminho do próprio site:
 * - "/sofi/x.webp"            fotos iniciais (pasta public/)
 * - "/media/produtos/uuid.webp" fotos enviadas pelo painel (servidas por app/media)
 */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("/")) return path;
  return null;
}

/** Fotos enviadas pelo painel, que podem ser apagadas do armazenamento. */
export function isUploadedPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/media/");
}

export const MEDIA_PATH = /^(produtos|capa|logo)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
