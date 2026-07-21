/**
 * Save/load progress theater. The real operations are
 * near-instant; this gives them a perceptible, elegant moment: a bar that
 * eases to ~90% while the work happens, snaps to 100% on completion, shows a
 * check, then hands control back. If the operation ends in cancel/error the
 * parent simply unmounts this overlay.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  mode: 'save' | 'load';
  /** Parent flips this when the real operation has finished successfully. */
  done: boolean;
  /** Called once the 100% + check moment has played out. */
  onFinished: () => void;
}

const LABEL = {
  save: { busy: 'Saving your progress…', done: 'Saved' },
  load: { busy: 'Reading your file…', done: '¡Listo!' },
};

export default function TransferOverlay({ mode, done, onFinished }: Props) {
  const [pct, setPct] = useState(0);
  const [complete, setComplete] = useState(false);
  const raf = useRef<number>(0);
  // Parents pass inline closures; keep the latest without retriggering effects.
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  // Ease toward 90% while busy; sprint to 100% once done.
  useEffect(() => {
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = now - started;
      setPct((current) => {
        if (done) return Math.min(100, current + 4.5);
        const target = 90 * (1 - Math.exp(-elapsed / 450));
        return Math.max(current, Math.min(90, target));
      });
      raf.current = requestAnimationFrame(tick);
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

  const accent = mode === 'save' ? 'from-success to-gold' : 'from-vocab to-gold';

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
            <p className="m-0 text-sm font-semibold text-ink-soft">{LABEL[mode].busy}</p>
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
