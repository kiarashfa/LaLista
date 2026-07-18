// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site under /LaLista/ (project page). The base is
// applied on CI (and when DEPLOY_BASE=1 for local base testing) so local dev
// stays at "/". All internal links go through src/lib/paths.ts withBase().
const deployed = process.env.GITHUB_ACTIONS === 'true' || process.env.DEPLOY_BASE === '1';

// https://astro.build/config
export default defineConfig({
  site: 'https://kiarashfa.github.io',
  base: deployed ? '/LaLista' : '/',
  integrations: [react(), mdx()],

  vite: {
    plugins: [tailwindcss()]
  }
});