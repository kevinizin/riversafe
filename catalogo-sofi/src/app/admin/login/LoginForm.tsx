"use client";

import { signIn, type FormState } from "@/app/admin/actions";
import { Field, FormMessage, inputClass, SubmitButton, useFormAction } from "@/components/admin/ui";

export function LoginForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(signIn, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage message={state.message} />
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className={inputClass}
        />
      </Field>
      <Field label="Senha">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className={inputClass}
        />
      </Field>
      <SubmitButton pending={pending} pendingText="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
