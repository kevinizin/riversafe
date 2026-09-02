import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Website Opportunity Hunter',
  description: 'Find UK businesses that are in the right moment to buy a website.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
