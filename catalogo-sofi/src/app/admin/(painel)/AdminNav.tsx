"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Produtos", match: (p: string) => p === "/admin" || p.startsWith("/admin/produtos") },
  { href: "/admin/categorias", label: "Categorias", match: (p: string) => p.startsWith("/admin/categorias") },
  { href: "/admin/configuracoes", label: "Loja", match: (p: string) => p.startsWith("/admin/configuracoes") },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
            l.match(pathname) ? "bg-ink text-cream" : "text-ink-soft hover:bg-cream-deep"
          }`}
        >
          {l.label}
        </Link>
      ))}
      <a
        href="/"
        target="_blank"
        rel="noopener"
        className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
      >
        Ver catálogo ↗
      </a>
    </nav>
  );
}
