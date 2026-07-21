/**
 * Workbook score bands:
 * green ≥ 80%, yellow 50–79%, red < 50% — of the best attempt ever.
 */
export type ScoreBand = 'none' | 'poor' | 'fair' | 'good';

export function scoreBand(correct: number, total: number): ScoreBand {
  if (total <= 0) return 'none';
  const pct = correct / total;
  if (pct >= 0.8) return 'good';
  if (pct >= 0.5) return 'fair';
  return 'poor';
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  none: 'Not attempted',
  poor: 'Needs a re-read',
  fair: 'Getting there',
  good: 'Solid',
};
