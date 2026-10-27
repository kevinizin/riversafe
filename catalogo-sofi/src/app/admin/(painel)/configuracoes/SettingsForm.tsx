"use client";

import { useEffect, useRef } from "react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import {
  Field,
  FormMessage,
  inputClass,
  SubmitButton,
  Switch,
  useFormAction,
} from "@/components/admin/ui";
import { centsToInput } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";
import { changePassword, saveSettings, type FormState } from "../../actions";

export function SettingsForm({
  settings,
  coverUrl,
  logoUrl,
}: {
  settings: StoreSettings;
  coverUrl: string | null;
  logoUrl: string | null;
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveSettings, {});
  const e = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]" noValidate>
      <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
        <ImagePicker currentUrl={coverUrl} error={e.image} aspect="aspect-[4/5]" label="Foto de capa" />
        <div className="max-w-44">
          <ImagePicker
            currentUrl={logoUrl}
            error={e.logo}
            aspect="aspect-square"
            label="Logo"
            name="logo"
            removeName="remove_logo"
          />
        </div>
      </div>

      <div className="space-y-5">
        <FormMessage ok={state.ok} message={state.message} />

        <Switch
          name="accepting_orders"
          label="Aceitando pedidos"
          description="Desligue para pausar os pedidos (feriado, agenda cheia…). O catálogo continua no ar."
          defaultChecked={settings.accepting_orders}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome da loja" error={e.name}>
            <input name="name" defaultValue={settings.name} maxLength={80} className={inputClass} aria-invalid={!!e.name} />
          </Field>
          <Field label="WhatsApp que recebe os pedidos" hint="Com DDI e DDD: 55 11 98765-4321" error={e.whatsapp}>
            <input
              name="whatsapp"
              defaultValue={settings.whatsapp}
              inputMode="tel"
              maxLength={20}
              className={inputClass}
              aria-invalid={!!e.whatsapp}
            />
          </Field>
        </div>

        <Field label="Frase de apresentação" error={e.tagline}>
          <input name="tagline" defaultValue={settings.tagline ?? ""} maxLength={160} className={inputClass} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Horário de funcionamento" error={e.hours_text}>
            <input
              name="hours_text"
              defaultValue={settings.hours_text ?? ""}
              maxLength={200}
              placeholder="Ter a sáb, 9h às 19h"
              className={inputClass}
            />
          </Field>
          <Field label="Instagram" hint="Só o usuário, sem @" error={e.instagram}>
            <input
              name="instagram"
              defaultValue={settings.instagram ?? ""}
              maxLength={31}
              className={inputClass}
              aria-invalid={!!e.instagram}
            />
          </Field>
        </div>

        <Field label="Endereço" error={e.address}>
          <input name="address" defaultValue={settings.address ?? ""} maxLength={200} className={inputClass} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Switch name="delivery_enabled" label="Fazemos entrega" defaultChecked={settings.delivery_enabled} />
          <Switch
            name="pickup_enabled"
            label="Cliente pode retirar"
            defaultChecked={settings.pickup_enabled}
            error={e.pickup_enabled}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Taxa de entrega (R$)" hint="0,00 = entrega grátis" error={e.delivery_fee_cents}>
            <input
              name="delivery_fee_cents"
              defaultValue={centsToInput(settings.delivery_fee_cents)}
              inputMode="decimal"
              className={inputClass}
              aria-invalid={!!e.delivery_fee_cents}
            />
          </Field>
          <Field label="Pedido mínimo (R$)" hint="0,00 = sem mínimo" error={e.min_order_cents}>
            <input
              name="min_order_cents"
              defaultValue={centsToInput(settings.min_order_cents)}
              inputMode="decimal"
              className={inputClass}
              aria-invalid={!!e.min_order_cents}
            />
          </Field>
        </div>

        <div className="border-t border-line pt-6">
          <SubmitButton pending={pending}>Salvar configurações</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-4 max-w-xl space-y-4 rounded-2xl border border-line bg-white p-5">
      <FormMessage ok={state.ok} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nova senha" hint="Mínimo 10 caracteres, com letras e números" error={e.password}>
          <input name="password" type="password" autoComplete="new-password" maxLength={128} className={inputClass} />
        </Field>
        <Field label="Repita a senha" error={e.confirm}>
          <input name="confirm" type="password" autoComplete="new-password" maxLength={128} className={inputClass} />
        </Field>
      </div>
      <SubmitButton pending={pending}>Trocar senha</SubmitButton>
    </form>
  );
}
