import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, logout } from '@/lib/auth';
import { integrations } from '@/lib/context';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/search', label: 'New search' },
  { href: '/leads', label: 'Leads' },
  { href: '/crm', label: 'CRM' },
  { href: '/searches', label: 'History' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/system', label: 'System' },
  { href: '/settings', label: 'Settings' },
];

async function logoutAction() {
  'use server';
  await logout();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const status = integrations();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-sm font-semibold">
            Website Opportunity Hunter
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
                Sign out
              </button>
            </form>
          </div>
        </div>
        {status.companiesHouse === 'missing' ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Companies House is not configured — searches run against the fictional demo dataset. Add
            COMPANIES_HOUSE_API_KEY to search real UK companies.
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
