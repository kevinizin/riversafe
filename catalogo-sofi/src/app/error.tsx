"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-display text-3xl font-semibold">Algo deu errado</p>
        <p className="mt-3 text-ink-soft">Não conseguimos carregar esta página agora.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-7 font-semibold text-cream hover:bg-accent"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
