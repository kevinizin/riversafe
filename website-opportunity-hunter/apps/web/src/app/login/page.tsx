'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { loginAction, type LoginState } from './actions';

function LoginForm() {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="card w-full max-w-sm p-6">
      <h1 className="text-lg font-semibold">Website Opportunity Hunter</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to run searches and review leads.</p>

      <input type="hidden" name="next" value={params.get('next') ?? '/'} />

      <div className="mt-5">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="password">Password</label>
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
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
