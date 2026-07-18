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

## Layout

- `data/` — human-edited source of truth (workbook, 57 grammar lesson folders).
  `data/vocabulary/master.xlsx` is **gitignored**; see `data/vocabulary/README.md`.
- `src/content/vocabulary/` — **generated** by `npm run data:convert`; committed
  (CI can't see the workbook). Never hand-edit.
- `public/audio/` — `<wordId>_<n>.mp3`; `*_1.mp3` are personal-use only and
  gitignored (SPEC §14).
- `scripts/` — permanent pipeline tooling. `scratch/` — gitignored scratch space.
- `SPEC.md` / `GRAMMAR-AUTHORING-GUIDE.md` — the project contract; read before
  changing behavior.
