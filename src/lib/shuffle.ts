/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle that avoids returning the given "solution" order when any other
 * order exists (so a reorder puzzle never starts pre-solved).
 */
export function shuffleAvoiding<T>(items: readonly T[], solution: readonly T[]): T[] {
  if (items.length < 2) return [...items];
  for (let tries = 0; tries < 10; tries++) {
    const out = shuffle(items);
    if (out.some((v, i) => v !== solution[i])) return out;
  }
  return [...items].reverse();
}
