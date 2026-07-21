/**
 * Study sections require a loaded profile. This overlay
 * blocks the Vocabulary/Grammar surfaces until a save file is loaded or a
 * fresh profile created. Purely client-side — the static content underneath
 * still exists for crawlers; the study islands additionally refuse to start
 * without a profile so keyboard input can't reach them behind the overlay.
 */
import { useEffect, useState } from 'react';
import { getProfile } from '../../lib/storage/session';
import { withBase } from '../../lib/paths';

export default function ProfileGate() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(!getProfile());
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base/75 p-6 backdrop-blur-[3px]" role="dialog" aria-label="Profile needed">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-lg border border-border bg-surface-raised px-8 py-9 text-center shadow-lg">
        <span className="font-display pointer-events-none absolute -top-10 -left-2 text-[9rem] leading-none font-light text-vocab opacity-[0.06] select-none" aria-hidden="true">¿</span>
        <p className="relative m-0 text-3xl" aria-hidden="true">👋</p>
        <h2 className="relative mt-3 mb-2 text-xl font-bold text-ink">First, a home for your progress</h2>
        <p className="relative m-0 text-sm leading-relaxed text-ink-soft">
          Studying without a profile would leave your progress with nowhere to live. Load your{' '}
          <b>lalista-progress</b> file — or start fresh — and come right back.
        </p>
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href={withBase('/progress/')} className="rounded-pill bg-vocab px-6 py-3 text-sm font-bold text-white no-underline hover:bg-vocab-hover">
            Open Progress →
          </a>
          <a href={withBase('/')} className="rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink no-underline hover:border-ink-faint">
            Back home
          </a>
        </div>
      </div>
    </div>
  );
}
