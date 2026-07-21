/**
 * Brief, subtle prep animation — the quiet sibling of
 * TransferOverlay: inline (no modal), ~600 ms, ease-out fill, then done.
 * Used when a workbook or vocabulary session is being "prepared".
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  accent?: 'grammar' | 'vocab';
  durationMs?: number;
  onDone: () => void;
}

export default function LoadingBar({ label, accent = 'grammar', durationMs = 600, onDone }: Props) {
  const [pct, setPct] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    let finished = false;
    const tick = (now: number) => {
      const x = Math.min(1, (now - t0) / durationMs);
      setPct((1 - (1 - x) ** 2) * 100); // ease-out
      if (x >= 1) {
        if (!finished) {
          finished = true;
          doneRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <div className="flex flex-col items-center gap-3 py-14" role="status" aria-label={label}>
      <p className="m-0 text-sm font-semibold text-ink-faint">{label}</p>
      <div className="h-1 w-44 overflow-hidden rounded-pill bg-surface-sunken">
        <div
          className={`h-full rounded-pill bg-gradient-to-r ${accent === 'vocab' ? 'from-vocab to-gold' : 'from-grammar to-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
