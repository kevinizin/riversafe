import { APP_NAME } from '@woh/config';
import { findLogo } from '@/lib/brandAsset';

/**
 * The Azven mark in the header and on the sign-in page.
 *
 * It renders the logo file when one has been dropped into `apps/web/public`,
 * and the name set as type when one has not. That fallback is the point: an
 * `<img>` pointing at a file that is not there renders a broken-image icon in
 * the corner of every page, which looks worse than no logo at all and is the
 * kind of thing nobody gets round to fixing.
 *
 * To use a real logo, drop a file into `apps/web/public` under one of the
 * names `findLogo` checks. Nothing else needs changing — no rebuild step, no
 * import, no config, and the browser tab icon picks up the same file. SVG is
 * the best choice because it stays sharp on any screen; a PNG at roughly 3×
 * the displayed height is the practical alternative.
 */

export function Brand({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const file = findLogo()?.url;
  const height = size === 'lg' ? 40 : 24;

  if (file) {
    return (
      // Width is left to the intrinsic aspect ratio so a wide wordmark and a
      // square icon both come out right without anyone editing this file.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file}
        alt={APP_NAME}
        style={{ height, width: 'auto' }}
        className="block"
      />
    );
  }

  return (
    <span className={size === 'lg' ? 'text-2xl font-bold tracking-tight' : 'text-sm font-semibold tracking-tight'}>
      {APP_NAME}
    </span>
  );
}
