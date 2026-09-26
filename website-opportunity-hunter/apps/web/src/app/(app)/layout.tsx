import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { getCurrentUser, logout } from '@/lib/auth';
import { countriesWithoutRealData } from '@/lib/context';

const NAV = [
  { href: '/', label: 'Painel' },
  { href: '/search', label: 'Nova busca' },
  { href: '/leads', label: 'Leads' },
  { href: '/crm', label: 'Funil' },
  { href: '/searches', label: 'Histórico' },
  { href: '/analytics', label: 'Métricas' },
  { href: '/system', label: 'Sistema' },
  { href: '/settings', label: 'Configurações' },
];

async function logoutAction() {
  'use server';
  await logout();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const missingData = await countriesWithoutRealData();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center">
            <Brand />
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span title={user.email}>{user.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="text-slate-600 underline hover:text-ink">
                Sair
              </button>
            </form>
          </div>
        </div>
        {missingData.length ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Sem fonte de dados reais para {missingData.join(' e ')} — buscas nesses países usam as 15
            empresas fictícias de demonstração. Para o Brasil, importe um arquivo mensal da Receita
            Federal (<code>npm run ingest:br</code>); para o Reino Unido, adicione
            COMPANIES_HOUSE_API_KEY ao arquivo .env.
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
