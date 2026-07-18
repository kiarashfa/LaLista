/**
 * Base-path-aware URL helper. GitHub Pages serves the site under /LaLista/,
 * so every internal href/src must go through this rather than hardcoding "/".
 */
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** URL for a word's audio file in public/audio. */
export function audioUrl(filename: string): string {
  return withBase(`/audio/${filename}`);
}
