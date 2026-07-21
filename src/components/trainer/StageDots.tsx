/**
 * 7-dot stage indicator (abstract dots — deliberately NOT a
 * plant/growth metaphor). Filled-dot opacity carries the cosmetic freshness
 * axis: pale = not reinforced lately, never "forgotten".
 */
import { dotsFor, type Stage } from '../../lib/srs/stages';

interface Props {
  stage: Stage;
  /** 0.35–1 from freshness(); dims the filled dots only. */
  freshness?: number;
  difficult?: boolean;
  excluded?: boolean;
  accent?: boolean;
}

export function StageDots({ stage, freshness = 1, difficult = false, excluded = false, accent = false }: Props) {
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
      {excluded && (
        <svg className="ml-1 h-3 w-3 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="excluded from Review and Test">
          <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.4 18.4 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"></path>
          <path d="m2 2 20 20"></path>
        </svg>
      )}
    </span>
  );
}
