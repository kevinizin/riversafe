import { Suspense } from 'react';
import { Brand } from '@/components/brand';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <Suspense fallback={<div className="text-sm text-slate-500">Carregando…</div>}>
        <LoginForm brand={<Brand size="lg" />} />
      </Suspense>
    </main>
  );
}
