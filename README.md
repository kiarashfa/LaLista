# LaLista

Free, no-login, no-ad Spanish (Castellano) learning site: Memrise-style
vocabulary trainer (2001 words, 27 topic groups, per-word audio) + a 57-chapter
topic-based grammar reference with interactive workbooks.

Static Astro site → GitHub Pages. No backend; progress lives in a save file the
user keeps (File System Access API / download fallback).

## Develop

```sh
npm install
npm run dev        # dev server
npm run build      # production build
npm run data:all   # rebuild vocabulary JSON from data/vocabulary/master.xlsx + validate everything
npm test           # unit tests
```

## Deploy

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
tests + data validation, then an Astro build published to GitHub Pages at
`https://kiarashfa.github.io/LaLista/`. The base path applies automatically on
CI; local dev stays at `/`. To test a based build locally:
`DEPLOY_BASE=1 npx astro build`.

## Audio voices

Each word offers up to three pronunciations, in this priority order:
`<id>_1.mp3` (WordReference — the default voice, published by owner decision
2026-07-20, overriding the earlier personal-use rule), `<id>_2.mp3`
(Lingua Libre, CC BY 4.0), and `<id>_3.mp3` (Piper TTS, present for every
word). The first available voice is the big play button and the auto-play
target; the others are one click away.

## Layout

- `data/` — human-edited source of truth (workbook, 57 grammar lesson folders).
  `data/vocabulary/master.xlsx` is **gitignored**; see `data/vocabulary/README.md`.
- `src/content/vocabulary/` — **generated** by `npm run data:convert`; committed
  (CI can't see the workbook). Never hand-edit.
- `public/audio/` — `<wordId>_<n>.mp3`, all three voices committed and deployed.
- `scripts/` — permanent pipeline tooling. `scratch/` — gitignored scratch space.
- The product spec (`SPEC.md`) and grammar-content contract (`Grammar.md`)
  are maintained privately alongside this repo (gitignored) — behavior
  decisions live there, not in this README.
