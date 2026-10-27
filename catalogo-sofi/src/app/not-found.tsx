import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl font-semibold text-accent">404</p>
        <p className="mt-3 text-lg text-ink-soft">Esta página não existe.</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-7 font-semibold text-cream hover:bg-accent"
        >
          Ir para o catálogo
        </Link>
      </div>
    </main>
  );
}
