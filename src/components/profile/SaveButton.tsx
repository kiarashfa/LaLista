/**
 * Nav save chip — the always-visible save action SPEC §5 requires ("not
 * buried in a settings menu"). Shows nothing until a profile exists.
 */
import { withBase } from '../../lib/paths';
import { AvatarView } from './AvatarPicker';
import { useSave } from './useSave';

export default function SaveButton() {
  const { profile, dirty, status, save } = useSave();
  if (!profile) return null;

  return (
    <span className="flex items-center gap-2">
      <a href={withBase('/progress/')} title={`${profile.name} — open Progress`} className="hidden items-center no-underline sm:flex">
        <AvatarView avatar={profile.avatar} size={32} />
      </a>
      <button
        type="button"
        onClick={() => void save()}
        title={dirty ? 'You have unsaved progress — save to your file' : 'Save progress to your file'}
        className="relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface-base px-2.5 text-sm font-semibold text-ink-soft hover:border-success hover:text-success sm:h-10 sm:px-3"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <path d="M17 21v-8H7v8M7 3v5h8"></path>
        </svg>
        <span className="hidden sm:inline">{status ?? 'Save'}</span>
        {dirty && !status && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-pill bg-vocab" aria-label="unsaved changes" />}
      </button>
    </span>
  );
}
