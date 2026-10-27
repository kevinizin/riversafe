"use client";

import { useEffect, useRef } from "react";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { FormMessage, inputClass, SubmitButton, useFormAction } from "@/components/admin/ui";
import type { Category } from "@/lib/types";
import { deleteCategory, saveCategory, type FormState } from "../../actions";

export function CategoryManager({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <section>
        <h2 className="sr-only">Categorias existentes</h2>
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center text-ink-soft">
            Nenhuma categoria ainda. Crie a primeira ao lado.
          </p>
        ) : (
          <ul className="space-y-3">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} count={counts[c.id] ?? 0} />
            ))}
          </ul>
        )}
      </section>
      <NewCategory nextOrder={(categories.at(-1)?.sort_order ?? 0) + 1} />
    </div>
  );
}

function CategoryRow({ category, count }: { category: Category; count: number }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveCategory, {});
  const e = state.errors ?? {};

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-end gap-3">
        <form onSubmit={onSubmit} className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={category.id} />
          <label className="min-w-48 flex-1">
            <span className="text-xs font-semibold text-muted">Nome</span>
            <input
              name="name"
              defaultValue={category.name}
              maxLength={60}
              className={inputClass}
              aria-invalid={!!e.name}
            />
          </label>
          <label className="w-20">
            <span className="text-xs font-semibold text-muted">Ordem</span>
            <input
              name="sort_order"
              defaultValue={category.sort_order}
              inputMode="numeric"
              className={inputClass}
            />
          </label>
          <label className="flex h-[46px] items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={category.is_active}
              className="h-4 w-4 accent-[var(--color-leaf)]"
            />
            Visível
          </label>
          <SubmitButton pending={pending} pendingText="…" className="h-[46px]">
            Salvar
          </SubmitButton>
        </form>
        <div className="pb-1">
          <ConfirmDelete
            action={deleteCategory}
            id={category.id}
            compact
            label={`Excluir ${category.name}`}
            message={
              count > 0
                ? `Excluir “${category.name}”? Os ${count} produto(s) dela continuam existindo, mas ficam sem categoria.`
                : `Excluir “${category.name}”?`
            }
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {count} {count === 1 ? "produto" : "produtos"}
      </p>
      {(e.name || e.sort_order || state.message) && (
        <div className="mt-2">
          <FormMessage ok={state.ok} message={e.name ?? e.sort_order ?? state.message} />
        </div>
      )}
    </li>
  );
}

function NewCategory({ nextOrder }: { nextOrder: number }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveCategory, {});
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="h-fit rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24">
      <h2 className="font-semibold">Nova categoria</h2>
      <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-4">
        <FormMessage ok={state.ok} message={state.message} />
        <label className="block">
          <span className="text-sm font-semibold">Nome</span>
          <input
            name="name"
            maxLength={60}
            placeholder="Ex.: Bolos de pote"
            className={inputClass}
            aria-invalid={!!e.name}
          />
          {e.name && <span className="mt-1 block text-sm text-accent">{e.name}</span>}
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Ordem</span>
          <input
            name="sort_order"
            key={nextOrder}
            defaultValue={nextOrder}
            inputMode="numeric"
            className={inputClass}
          />
        </label>
        <input type="hidden" name="is_active" value="on" />
        <SubmitButton pending={pending} className="w-full">
          Criar categoria
        </SubmitButton>
      </form>
    </section>
  );
}
