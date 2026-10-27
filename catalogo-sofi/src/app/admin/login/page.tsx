import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env";
import { isLoggedIn } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Painel", robots: { index: false } };

export default async function LoginPage() {
  await connection();
  if (await isLoggedIn()) redirect("/admin");

  return (
    <main className="grid min-h-dvh place-items-center bg-cream-deep/60 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sofi/logo.webp" alt="" className="mx-auto h-20 w-20 rounded-full shadow-card" />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Painel da loja</h1>
          <p className="mt-1 text-sm text-muted">Entre para gerenciar seu catálogo</p>
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-card">
          {isDemoMode && (
            <p className="mb-5 rounded-xl bg-cream-deep px-4 py-3 text-sm text-ink-soft">
              O painel ainda não foi configurado neste servidor.
            </p>
          )}
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Sistema por Azven · conexão protegida</p>
      </div>
    </main>
  );
}
