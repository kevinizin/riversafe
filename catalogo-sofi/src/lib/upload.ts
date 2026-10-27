import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET } from "@/lib/env";
import { isStoragePath } from "@/lib/images";

export class UserFacingError extends Error {}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

/**
 * Recebe a foto enviada pelo painel, confere que é mesmo uma imagem,
 * corrige a rotação, reduz o tamanho e regrava como WebP.
 * Regravar descarta metadados (GPS do celular, etc.) e qualquer conteúdo
 * escondido no arquivo — o que vai para o Storage é sempre uma imagem limpa.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  file: FormDataEntryValue | null,
  folder: "produtos" | "capa" | "logo",
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UserFacingError("A foto deve ter no máximo 4 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error("formato");
    const side = folder === "capa" ? 2000 : folder === "logo" ? 600 : 1400;
    output = await image
      .rotate()
      .resize({
        width: side,
        height: side,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UserFacingError("Não foi possível ler a foto. Use um arquivo JPG, PNG ou WebP.");
  }

  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, output, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new UserFacingError("Falha ao enviar a foto. Tente novamente.");
  return path;
}

export async function removeImage(supabase: SupabaseClient, path: string | null | undefined) {
  if (!isStoragePath(path)) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}
