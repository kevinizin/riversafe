import type { Metadata } from 'next';
import { APP_NAME, APP_TAGLINE } from '@woh/config';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  // An internal tool holding other companies' data has no business being
  // indexed, even by accident behind a login.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
