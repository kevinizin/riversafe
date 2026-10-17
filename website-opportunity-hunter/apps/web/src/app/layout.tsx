import type { Metadata } from 'next';
import { APP_NAME, APP_TAGLINE } from '@woh/config';
import { findLogo } from '@/lib/brandAsset';
import './globals.css';

/**
 * The tab icon, when there is no logo file yet.
 *
 * The first letter of the name on the brand colour, as an inline SVG — so a
 * fresh install has a mark in the tab rather than the browser's blank sheet,
 * which beside a named, finished product reads as unfinished. Replaced the
 * moment a real logo is dropped in.
 */
const FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="14" fill="#1f6feb"/>` +
      `<text x="32" y="45" text-anchor="middle" fill="#fff" font-size="40"` +
      ` font-family="system-ui,Arial,sans-serif" font-weight="700">${APP_NAME[0] ?? 'A'}</text>` +
      `</svg>`,
  );

/**
 * Generated per request rather than declared as a constant, so dropping a
 * logo into `public` changes the tab icon on the next restart without a
 * rebuild — the same promise the header makes.
 */
export function generateMetadata(): Metadata {
  const logo = findLogo();
  return {
    title: APP_NAME,
    description: APP_TAGLINE,
    icons: { icon: logo ? [{ url: logo.url, type: logo.type }] : [{ url: FALLBACK_ICON }] },
    // An internal tool holding other companies' data has no business being
    // indexed, even by accident behind a login.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
