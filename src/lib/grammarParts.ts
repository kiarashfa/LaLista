/**
 * The 13 Roman-numeral Parts (SPEC §6) — pure navigation/SEO grouping.
 * Chapters within a Part are NOT ordered by difficulty; prerequisites in
 * meta.json are courtesy pointers only.
 */
export interface GrammarPart {
  numeral: string;
  title: string;
  /** Inclusive chapter range, 1-based. */
  from: number;
  to: number;
}

export const GRAMMAR_PARTS: GrammarPart[] = [
  { numeral: 'I', title: 'The Noun Phrase', from: 1, to: 10 },
  { numeral: 'II', title: 'Pronouns', from: 11, to: 19 },
  { numeral: 'III', title: 'Verbs: Foundations & Present-Time Reference', from: 20, to: 25 },
  { numeral: 'IV', title: 'Verbs: Past Time Reference', from: 26, to: 32 },
  { numeral: 'V', title: 'Verbs: Future & Conditional', from: 33, to: 35 },
  { numeral: 'VI', title: 'The Imperative', from: 36, to: 36 },
  { numeral: 'VII', title: 'The Subjunctive Mood', from: 37, to: 41 },
  { numeral: 'VIII', title: 'Non-Finite Forms & Verb Periphrases', from: 42, to: 45 },
  { numeral: 'IX', title: 'Passive & Impersonal Constructions', from: 46, to: 47 },
  { numeral: 'X', title: 'Prepositions', from: 48, to: 50 },
  { numeral: 'XI', title: 'Conjunctions & Connectors', from: 51, to: 52 },
  { numeral: 'XII', title: 'Sentence Structure & Word Order', from: 53, to: 54 },
  { numeral: 'XIII', title: 'Pragmatics, Register & Discourse', from: 55, to: 57 },
];

export function lessonNumber(lessonId: string): number {
  return Number(lessonId.replace('lesson-', ''));
}

export function lessonId(n: number): string {
  return `lesson-${String(n).padStart(2, '0')}`;
}

export function partOf(id: string): GrammarPart {
  const n = lessonNumber(id);
  const part = GRAMMAR_PARTS.find((p) => n >= p.from && n <= p.to);
  if (!part) throw new Error(`No Part contains ${id}`);
  return part;
}
