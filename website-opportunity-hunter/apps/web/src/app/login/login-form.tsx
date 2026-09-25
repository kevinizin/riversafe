'use client';

import { useActionState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction, type LoginState } from './actions';

/**
 * The sign-in form.
 *
 * Split from the page because it needs client hooks while the page needs to
 * read the logo off disk, which only a server component can do. The mark is
 * passed in as a node rather than imported here for the same reason.
 */
export function LoginForm({ brand }: { brand: ReactNode }) {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="card w-full max-w-sm p-6">
      <div className="flex justify-center">{brand}</div>
      <p className="mt-3 text-center text-sm text-slate-500">
        Entre para rodar buscas e revisar leads.
      </p>

      <input type="hidden" name="next" value={params.get('next') ?? '/'} />

      <div className="mt-5">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary mt-5 w-full">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
