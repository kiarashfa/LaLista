ListO/
├── .github/
│   └── workflows/
│       └── deploy.yml                 # builds + deploys to GitHub Pages on push to main
│
├── data/                              # SOURCE OF TRUTH for content (human-edited)
│   ├── vocabulary/
│   │   ├── master.xlsx                # ⚠ GITIGNORED — never published, local-only.
│   │   │                              #   Keep your own backup outside git (cloud drive etc.)!
│   │   └── README.md                  # how to edit it, column rules, ID rules, backup reminder
│   │
│   └── grammar/
│       ├── lesson-01/
│       │   ├── lesson.mdx             # the "textbook page"
│       │   ├── exercises.json         # the "workbook page"
│       │   └── meta.json              # title, level, topic tags, prerequisite lessons
│       │                              #   (THIS drives website sorting/filtering, not the
│       │                              #    folder name. e.g.:
│       │                              #    { "title": "Present Tense: -AR Verbs",
│       │                              #      "level": "A1", "topics": ["verbs", "present-tense"],
│       │                              #      "prerequisites": [] }
│       ├── lesson-02/
│       ├── lesson-03/
│       ├── ...
│       ├── NUMBERING-PLAN.md          # authoritative topic-range map, e.g.:
│       │                              #   01-09 Foundations · 10-19 Present tense & regular verbs
│       │                              #   20-29 Pronouns · 30-39 Past tenses · 40-44 Future/conditional
│       │                              #   45-49 Subjunctive & advanced · 50 buffer/review
│       │                              #   (wide bands with headroom, not tight back-to-back ranges —
│       │                              #    shared with the Sonnet chat writing lesson content)
│       └── ... (50 total, simple sequential numbering, zero-padded)
│
├── scripts/                           # PERMANENT, reviewed, deploy-relevant tooling only
│   ├── convert-vocab.ts               # master.xlsx -> src/content/vocabulary/*.json
│   ├── validate-vocab.ts              # checks: duplicate IDs, missing audio files, bad encoding
│   ├── detect-duplicates.ts           # the auto-link + "needs disambiguation note" report
│   └── validate-grammar.ts            # checks: every lesson.mdx has matching exercises.json etc.
│
├── scratch/                           # ⚠ GITIGNORED — throwaway/one-off/debug scripts. Disposable.
│   └── (whatever Fable needs mid-task; never committed, never reviewed)
│
├── public/
│   └── audio/
│       ├── el-gato.mp3
│       ├── excursion.mp3
│       └── ... (~1200 files, flat, slug-named — no subfolder needed)
│
├── src/
│   ├── content/                       # GENERATED + Astro content collections
│   │   ├── vocabulary/
│   │   │   └── words.json             # compiled output of convert-vocab.ts — DO NOT HAND-EDIT
│   │   └── grammar/                   # Astro content collection config points here
│   │       └── (symlink or copy step from /data/grammar at build time — TBD, see note)
│   │
│   ├── components/
│   │   ├── mdx/                       # the grammar authoring component library
│   │   │   ├── ConjugationTable.tsx
│   │   │   ├── AudioExample.tsx
│   │   │   ├── SentenceDiagram.tsx
│   │   │   └── ... (the full set we'll design next)
│   │   ├── trainer/                   # vocabulary flashcard trainer islands
│   │   ├── exercises/                 # the 9 exercise-type React components
│   │   ├── profile/                   # profile picker, load/save UI
│   │   └── ui/                        # generic buttons, cards, layout primitives
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── LessonLayout.astro         # wraps every grammar lesson.mdx (nav, progress, etc.)
│   │   └── TrainerLayout.astro
│   │
│   ├── pages/                         # Astro file-based routing (URL structure)
│   │   ├── index.astro                # landing / profile picker
│   │   ├── vocabulary/
│   │   │   ├── index.astro            # topic group picker (the 20 groups)
│   │   │   └── [group].astro          # trainer session for one group, e.g. /vocabulary/colors
│   │   ├── grammar/
│   │   │   ├── index.astro            # lesson list (sortable/filterable, per your last answer)
│   │   │   └── [lesson].astro         # renders one lesson.mdx + its exercises.json
│   │   └── progress.astro             # load/save file page, stats overview
│   │
│   ├── lib/                           # framework-agnostic logic, unit-testable
│   │   ├── srs/
│   │   │   ├── stages.ts              # the New→Mastered stage machine we designed
│   │   │   └── scheduling.ts          # "when is this word next eligible" logic
│   │   ├── storage/
│   │   │   ├── fileSystemAccess.ts    # File System Access API wrapper
│   │   │   ├── downloadFallback.ts    # classic-download fallback path
│   │   │   └── schema.ts              # versioned save-file schema + migrations
│   │   ├── grading/
│   │   │   └── exerciseGraders.ts     # one grading fn per exercise type
│   │   └── duplicateDetection.ts      # the exact-match auto-link logic (also used by scripts/)
│   │
│   ├── types/                         # shared TypeScript types
│   │   ├── word.ts                    # Word, PartOfSpeech, Gender
│   │   ├── lesson.ts                  # Lesson, LessonMeta, ExerciseType
│   │   ├── profile.ts                 # Profile, SaveFile (versioned!)
│   │   └── srs.ts                     # WordProgress, Stage
│   │
│   └── styles/
│       └── global.css                 # Tailwind entry + design tokens
│
├── astro.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .gitignore                         # includes at minimum:
│                                       #   data/vocabulary/master.xlsx
│                                       #   scratch/
│                                       #   node_modules/
│                                       #   dist/
│                                       #   .env* (if any keys ever get used, e.g. Fable's own tooling)
└── README.md
