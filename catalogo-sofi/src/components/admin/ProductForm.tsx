"use client";

import Link from "next/link";
import { saveProduct, type FormState } from "@/app/admin/actions";
import { centsToInput } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { ImagePicker } from "./ImagePicker";
import { Field, FormMessage, inputClass, SubmitButton, Switch, useFormAction } from "./ui";

const TAG_SUGGESTIONS = ["Mais pedido", "Novidade", "Vegano", "Sem glúten", "Sem lactose", "Sob encomenda"];

export function ProductForm({
  product,
  imageUrl,
  categories,
}: {
  product: Product | null;
  imageUrl: string | null;
  categories: Category[];
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveProduct, {});
  const e = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[300px_1fr]" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="lg:sticky lg:top-24 lg:self-start">
        <ImagePicker currentUrl={imageUrl} error={e.image} />
      </div>

      <div className="space-y-5">
        <FormMessage message={state.message} ok={state.ok} />

        <Field label="Nome do produto" error={e.name}>
          <input
            name="name"
            defaultValue={product?.name}
            maxLength={100}
            required
            className={inputClass}
            aria-invalid={!!e.name}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Categoria" error={e.category_id}>
            <select
              name="category_id"
              defaultValue={product?.category_id ?? ""}
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : " (oculta)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Porção / tamanho" hint="Ex.: Serve 10 pessoas, 500 g, Fatia" error={e.serving}>
            <input
              name="serving"
              defaultValue={product?.serving ?? ""}
              maxLength={60}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Preço (R$)" error={e.price_cents}>
            <input
              name="price_cents"
              defaultValue={centsToInput(product?.price_cents)}
              inputMode="decimal"
              placeholder="0,00"
              required
              className={inputClass}
              aria-invalid={!!e.price_cents}
            />
          </Field>
          <Field
            label="Preço antigo (R$) — opcional"
            hint="Preencha para mostrar como promoção"
            error={e.compare_at_cents}
          >
            <input
              name="compare_at_cents"
              defaultValue={centsToInput(product?.compare_at_cents)}
              inputMode="decimal"
              placeholder="0,00"
              className={inputClass}
              aria-invalid={!!e.compare_at_cents}
            />
          </Field>
        </div>

        <Field label="Descrição" hint="Até 600 caracteres." error={e.description}>
          <textarea
            name="description"
            defaultValue={product?.description ?? ""}
            maxLength={600}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Field
          label="Etiquetas"
          hint={`Separe por vírgula. Sugestões: ${TAG_SUGGESTIONS.join(", ")}`}
          error={e.tags}
        >
          <input
            name="tags"
            defaultValue={product?.tags.join(", ") ?? ""}
            maxLength={200}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Switch
            name="is_available"
            label="Disponível"
            description="Desligado = Esgotado"
            defaultChecked={product?.is_available ?? true}
          />
          <Switch
            name="is_visible"
            label="Visível"
            description="Aparece no catálogo"
            defaultChecked={product?.is_visible ?? true}
          />
          <Switch
            name="is_featured"
            label="Destaque"
            description="Vai para o topo"
            defaultChecked={product?.is_featured ?? false}
          />
        </div>

        <Field
          label="Ordem"
          hint="Números menores aparecem primeiro dentro da categoria."
          error={e.sort_order}
          className="max-w-40"
        >
          <input
            name="sort_order"
            defaultValue={product?.sort_order ?? 0}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <SubmitButton pending={pending}>{product ? "Salvar alterações" : "Cadastrar produto"}</SubmitButton>
          <Link href="/admin" className="h-11 rounded-xl px-4 py-2.5 font-semibold text-ink-soft hover:bg-white">
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
