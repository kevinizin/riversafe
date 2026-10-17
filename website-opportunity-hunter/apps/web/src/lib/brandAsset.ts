import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Finding the logo file, for everything that needs to show it.
 *
 * Lives apart from the `Brand` component because the browser tab icon needs
 * the same answer and is set from the layout's metadata, not from a
 * component. Two copies of this lookup would drift the day someone adds a
 * format to one list and not the other, and the symptom — a header logo with
 * a blank tab icon — is subtle enough to survive a long time.
 *
 * The check runs per request rather than at build time, which is what makes
 * the promise in `public/LEIA-ME.txt` true: drop the file in and restart,
 * with no rebuild and nothing to edit.
 */

const PUBLIC_DIR = join(process.cwd(), 'public');

/** Checked in order; the first one present wins. */
const CANDIDATES = ['logo.svg', 'logo.png', 'logo.webp', 'logo.jpg'] as const;

const MEDIA_TYPE: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

export interface LogoAsset {
  /** Public URL path, e.g. `/logo.svg`. */
  url: string;
  /** Media type, which the tab icon has to be told explicitly. */
  type: string;
}

export function findLogo(): LogoAsset | null {
  for (const name of CANDIDATES) {
    if (existsSync(join(PUBLIC_DIR, name))) {
      const extension = name.split('.').pop() ?? '';
      return { url: `/${name}`, type: MEDIA_TYPE[extension] ?? 'image/png' };
    }
  }
  return null;
}
