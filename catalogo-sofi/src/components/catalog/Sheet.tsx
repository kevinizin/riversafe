"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  variant: "center" | "side";
  children: React.ReactNode;
};

/** Modal acessível com <dialog> nativo: foco preso, Esc fecha, fundo escurecido. */
export function Sheet({ open, onClose, label, variant, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        "fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 open:flex " +
        (variant === "side"
          ? "justify-end"
          : "items-end justify-center md:items-center md:p-6")
      }
    >
      {open && children}
    </dialog>
  );
}
