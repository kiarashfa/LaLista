/**
 * Content collections — Astro's content
 * layer (glob loader) points directly at /data/grammar, no copy/symlink step.
 *
 * Three parallel collections share the lesson folder name as their entry id
 * (lesson-01 … lesson-57), so pages join meta + prose + exercises by id.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lessonFolderId = ({ entry }: { entry: string }) => entry.split('/')[0];

/** Lesson prose (lesson.mdx) — no frontmatter; title/level live in grammarMeta. */
const grammarLessons = defineCollection({
  loader: glob({ pattern: 'lesson-*/lesson.mdx', base: './data/grammar', generateId: lessonFolderId }),
});

/** meta.json — the lesson metadata schema. */
const grammarMeta = defineCollection({
  loader: glob({ pattern: 'lesson-*/meta.json', base: './data/grammar', generateId: lessonFolderId }),
  schema: z.object({
    title: z.string(),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1']),
    topics: z.array(z.string()),
    prerequisites: z.array(z.string()),
    summary: z.string(),
  }),
});

/**
 * exercises.json — kept loose here; the full per-type discriminated union is
 * enforced by scripts/validate-grammar.ts.
 */
const grammarExercises = defineCollection({
  loader: glob({ pattern: 'lesson-*/exercises.json', base: './data/grammar', generateId: lessonFolderId }),
  schema: z.object({
    lessonId: z.string(),
    exercises: z.array(z.looseObject({ id: z.string(), type: z.string() })),
  }),
});

export const collections = { grammarLessons, grammarMeta, grammarExercises };
