import { MEDIA_PATH } from "@/lib/images";
import { readFile } from "@/lib/store";

// Entrega as fotos enviadas pelo painel, que ficam no Blob privado.
// Só caminhos de foto no formato exato são aceitos: nada além de media/ é acessível.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  if (!MEDIA_PATH.test(rel)) return new Response("Not found", { status: 404 });

  const file = await readFile(`media/${rel}`);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
