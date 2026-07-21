/**
 * Exact-match English duplicate detection.
 * Case-insensitive, trimmed — deliberately NO fuzzy or synonym matching.
 * Used by scripts/convert-vocab.ts to auto-populate relatedWords and to
 * produce the "needs disambiguation note" report.
 */

export function normalizeEnglish(english: string): string {
  return english.trim().toLowerCase();
}

export interface DuplicateGroup {
  /** The shared normalized English translation. */
  english: string;
  /** Ids of all words carrying that translation, in input order. */
  ids: string[];
}

/** Returns only groups with 2+ members — words whose English is unique are not duplicates. */
export function findExactDuplicates(
  words: ReadonlyArray<{ id: string; english: string }>,
): DuplicateGroup[] {
  const byEnglish = new Map<string, string[]>();
  for (const word of words) {
    const key = normalizeEnglish(word.english);
    const ids = byEnglish.get(key);
    if (ids) ids.push(word.id);
    else byEnglish.set(key, [word.id]);
  }
  return [...byEnglish.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([english, ids]) => ({ english, ids }));
}

/**
 * relatedWords for every word: members of its duplicate group (minus itself),
 * merged with manual additions (e.g. saber/conocer, which share no literal
 * English text). Manual links are applied symmetrically.
 */
export function buildRelatedWords(
  words: ReadonlyArray<{ id: string; english: string }>,
  manual: Readonly<Record<string, readonly string[]>> = {},
): Map<string, string[]> {
  const related = new Map<string, Set<string>>(words.map((w) => [w.id, new Set<string>()]));

  for (const group of findExactDuplicates(words)) {
    for (const id of group.ids) {
      const set = related.get(id)!;
      for (const other of group.ids) if (other !== id) set.add(other);
    }
  }

  for (const [id, links] of Object.entries(manual)) {
    const set = related.get(id);
    if (!set) throw new Error(`related-manual.json references unknown word id "${id}"`);
    for (const other of links) {
      const otherSet = related.get(other);
      if (!otherSet) throw new Error(`related-manual.json links "${id}" to unknown word id "${other}"`);
      set.add(other);
      otherSet.add(id);
    }
  }

  return new Map([...related.entries()].map(([id, set]) => [id, [...set].sort()]));
}
