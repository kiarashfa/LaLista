/**
 * Nav save chip — the always-visible save action, icon-only.
 * A coral dot marks unsaved changes; after a save attempt a brief ✓ (or ✕
 * on failure) appears next to the floppy. Hidden until a profile exists.
 */
import { useSave } from './useSave';

export default function SaveButton() {
  const { profile, dirty, status, save, overlay } = useSave();
  if (!profile) return null;

  const failed = status?.startsWith("Couldn't") ?? false;
  const label = status ?? (dirty ? 'You have unsaved progress — save to your file' : 'Save progress to your file');

  return (
    <span className="flex items-center">
      {overlay}
      <button
        type="button"
        onClick={() => void save()}
        title={label}
        aria-label={label}
        className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill border border-border bg-surface-base text-ink-soft hover:border-success hover:text-success sm:h-10 sm:w-10"
      >
        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <path d="M17 21v-8H7v8M7 3v5h8"></path>
        </svg>
        {status && (
          <span className={`absolute -top-1.5 -right-1 text-[0.72rem] font-bold ${failed ? 'text-error' : 'text-success'}`} aria-hidden="true">
            {failed ? '✕' : '✓'}
          </span>
        )}
        {dirty && !status && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-pill bg-vocab" aria-label="unsaved changes" />}
      </button>
    </span>
  );
}
