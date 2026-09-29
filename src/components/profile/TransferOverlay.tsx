/**
 * Save/load progress theater. The real operations are
 * near-instant; this gives them a perceptible, elegant moment: a bar that
 * eases to ~90% while the work happens, snaps to 100% on completion, shows a
 * check, then hands control back. If the operation ends in cancel/error the
 * parent simply unmounts this overlay.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  mode: 'save' | 'load' | 'sync';
  /** Overrides the busy caption (e.g. naming the cloud being read). */
  busyLabel?: string;
  /** Parent flips this when the real operation has finished successfully. */
  done: boolean;
  /** Called once the 100% + check moment has played out. */
  onFinished: () => void;
}

const LABEL = {
  save: { busy: 'Saving your progress…', done: 'Saved' },
  load: { busy: 'Reading your file…', done: '¡Listo!' },
  sync: { busy: 'Syncing your progress…', done: 'Synced' },
};

export default function TransferOverlay({ mode, busyLabel, done, onFinished }: Props) {
  const [pct, setPct] = useState(0);
  const [complete, setComplete] = useState(false);
  const raf = useRef<number>(0);
  // Parents pass inline closures; keep the latest without retriggering effects.
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const pctRef = useRef(0);

  // While busy, creep toward 95% ever more slowly — a slow network sync never
  // visibly stalls. Once done, ease out from wherever the bar is to 100% over
  // a short duration (longer when there's more left), never a jump.
  useEffect(() => {
    const started = performance.now();
    const from = pctRef.current;
    const finishMs = 250 + (100 - from) * 4;
    const tick = (now: number) => {
      const elapsed = now - started;
      let next: number;
      if (done) {
        const t = Math.min(1, elapsed / finishMs);
        next = from + (100 - from) * (1 - (1 - t) ** 3);
      } else {
        next = Math.max(pctRef.current, from + (95 - from) * (1 - Math.exp(-elapsed / 1200)));
      }
      pctRef.current = next;
      setPct(next);
      if (next < 100) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [done]);

  useEffect(() => {
    if (done && pct >= 100) setComplete(true);
  }, [done, pct]);

  // Separate effect so setting `complete` can't cancel its own timeout.
  useEffect(() => {
    if (!complete) return;
    const t = setTimeout(() => finishedRef.current(), 650);
    return () => clearTimeout(t);
  }, [complete]);

  const accent = mode === 'load' ? 'from-vocab to-gold' : 'from-success to-gold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/70 p-6 backdrop-blur-[2px]" role="status" aria-live="polite">
      <div className="w-full max-w-[320px] rounded-lg border border-border bg-surface-raised px-8 py-7 text-center shadow-lg">
        {complete ? (
          <p className="m-0 flex items-center justify-center gap-2 text-lg font-bold text-success">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5">
                <animate attributeName="stroke-dasharray" from="0 30" to="30 30" dur="0.3s" fill="freeze" />
              </path>
            </svg>
            {LABEL[mode].done}
          </p>
        ) : (
          <>
            <p className="m-0 text-sm font-semibold text-ink-soft">{busyLabel ?? LABEL[mode].busy}</p>
            <p className="display-friendly m-0 mt-1 text-4xl font-semibold text-ink tabular-nums">{Math.round(pct)}%</p>
          </>
        )}
        <div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-sunken">
          <div
            className={`h-full rounded-pill bg-gradient-to-r transition-[width] duration-100 ease-out ${accent}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
