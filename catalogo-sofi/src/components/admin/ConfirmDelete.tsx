"use client";

import { TrashIcon } from "@/components/icons";

/** Botão de excluir que pede confirmação antes de enviar o formulário. */
export function ConfirmDelete({
  action,
  id,
  message,
  label = "Excluir",
  compact,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  message: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={compact ? label : undefined}
        className={
          compact
            ? "grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent"
            : "inline-flex h-11 items-center gap-2 rounded-xl border border-accent/30 px-4 font-semibold text-accent hover:bg-accent-soft"
        }
      >
        <TrashIcon width={18} height={18} />
        {!compact && label}
      </button>
    </form>
  );
}
