"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, TrashIcon } from "@/components/icons";

const MAX_SIDE = 2000;
const TARGET_BYTES = 3 * 1024 * 1024;

/**
 * Reduz a foto no próprio navegador antes de enviar (fotos de celular têm
 * 5–12 MB). O servidor ainda revalida e regrava a imagem de qualquer forma.
 */
async function shrink(file: File): Promise<File> {
  if (file.size <= 900 * 1024 && file.type !== "image/heic") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.88, 0.8, 0.7]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    // Formato que o navegador não abre: envia o original e o servidor decide.
  }
  return file;
}

export function ImagePicker({
  currentUrl,
  error,
  aspect = "aspect-[4/5]",
  label = "Foto",
  name = "image",
  removeName = "remove_image",
}: {
  currentUrl: string | null;
  error?: string;
  aspect?: string;
  label?: string;
  name?: string;
  removeName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setLocalError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Escolha um arquivo de imagem.");
      input.value = "";
      return;
    }
    setBusy(true);
    const small = await shrink(file);
    if (small.size > 4 * 1024 * 1024) {
      setLocalError("Foto muito grande. Tente outra ou tire um print dela.");
      input.value = "";
      setBusy(false);
      return;
    }
    if (small !== file) {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
    }
    setPreview(URL.createObjectURL(small));
    setRemoved(false);
    setBusy(false);
  }

  const shown = preview ?? (removed ? null : currentUrl);

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <div
        className={`relative mt-1.5 ${aspect} w-full overflow-hidden rounded-2xl border border-dashed border-line bg-cream-deep/60`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center text-muted">
            <div>
              <ImageIcon className="mx-auto" width={32} height={32} />
              <p className="mt-2 text-sm">Nenhuma foto</p>
            </div>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold">
            Preparando foto…
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
        onChange={onPick}
        className="sr-only"
        id={`${name}-input`}
      />
      <input type="hidden" name={removeName} value={removed ? "on" : ""} />

      <div className="mt-2 flex gap-2">
        <label
          htmlFor={`${name}-input`}
          className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-white text-sm font-semibold hover:border-ink"
        >
          {shown ? "Trocar foto" : "Escolher foto"}
        </label>
        {shown && (
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setPreview(null);
              setRemoved(true);
            }}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-muted hover:text-accent"
            aria-label="Remover foto"
          >
            <TrashIcon width={18} height={18} />
          </button>
        )}
      </div>
      {(localError || error) && (
        <p className="mt-1.5 text-sm font-medium text-accent">{localError ?? error}</p>
      )}
      <p className="mt-1.5 text-[13px] text-muted">JPG, PNG ou WebP. A foto é otimizada automaticamente.</p>
    </div>
  );
}
