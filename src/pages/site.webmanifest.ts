/**
 * Web app manifest as an endpoint rather than a static public/ file, so every
 * path inside it goes through withBase() and stays correct both locally (base "/")
 * and on GitHub Pages (base "/LaLista/"). A hardcoded static manifest is wrong in
 * one of the two environments.
 */
import type { APIRoute } from 'astro';
import { withBase } from '../lib/paths';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: 'LaLista',
        short_name: 'LaLista',
        description: 'Free Spanish (Castellano) vocabulary trainer and complete grammar reference.',
        start_url: withBase('/'),
        scope: withBase('/'),
        display: 'standalone',
        background_color: '#fafaf7',
        theme_color: '#fafaf7',
        icons: [
          { src: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png' },
          { src: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png' },
          { src: withBase('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
