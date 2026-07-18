/**
 * 7-dot stage indicator (SPEC §8: abstract dots — deliberately NOT a
 * plant/growth metaphor). Filled-dot opacity carries the cosmetic freshness
 * axis: pale = not reinforced lately, never "forgotten".
 */
import { dotsFor, type Stage } from '../../lib/srs/stages';

interface Props {
  stage: Stage;
  /** 0.35–1 from freshness(); dims the filled dots only. */
  freshness?: number;
  difficult?: boolean;
  accent?: boolean;
}

export function StageDots({ stage, freshness = 1, difficult = false, accent = false }: Props) {
  const filled = dotsFor(stage);
  return (
    <span className="flex shrink-0 items-center gap-[2px]" aria-label={`Stage: ${filled} of 7`}>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className={['h-[5px] w-[5px] rounded-pill', i < filled ? (accent ? 'bg-vocab' : 'bg-success') : 'bg-border'].join(' ')}
          style={i < filled ? { opacity: freshness } : undefined}
        />
      ))}
      {difficult && (
        <svg className="ml-1 h-3 w-3 text-error" viewBox="0 0 24 24" fill="currentColor" aria-label="difficult word">
          <path d="M4 21V4h12l-2 4 2 4H6v9H4z"></path>
        </svg>
      )}
    </span>
  );
}
