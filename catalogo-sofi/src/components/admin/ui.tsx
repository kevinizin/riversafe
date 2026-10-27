"use client";

import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";

type FormActionFn<S> = (prev: Awaited<S>, formData: FormData) => Promise<S>;

/**
 * Envia o formulário para a server action SEM o reset automático do React 19,
 * assim nada do que foi digitado (nem a foto escolhida) se perde quando a
 * validação devolve um erro.
 */
export function useFormAction<S>(fn: FormActionFn<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return [state, onSubmit, pending] as const;
}

export const inputClass =
  "mt-1.5 block w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 aria-[invalid=true]:border-accent";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm font-medium text-accent">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[13px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Switch({
  name,
  label,
  description,
  defaultChecked,
  error,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  error?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
        {error && <span className="block text-sm font-medium text-accent">{error}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-leaf peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  className = "",
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-cream transition hover:bg-accent disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-sm font-medium ${
        ok ? "bg-leaf-soft text-leaf" : "bg-accent-soft text-accent-deep"
      }`}
    >
      {message}
    </p>
  );
}
