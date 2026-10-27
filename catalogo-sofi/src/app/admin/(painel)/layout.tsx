import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../actions";
import { AdminNav } from "./AdminNav";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const { user } = await requireAdmin();

  return (
    <div className="min-h-dvh bg-cream-deep/40">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink font-display font-semibold text-cream">
            A
          </span>
          <AdminNav />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted lg:block">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="h-9 rounded-lg px-3 text-sm font-semibold text-ink-soft hover:bg-cream-deep"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</div>
    </div>
  );
}
