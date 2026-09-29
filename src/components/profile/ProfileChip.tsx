/**
 * Nav avatar chip: the profile picture doubles as the link to the
 * Progress page. Shows a neutral silhouette until a profile is created
 * or loaded, so Progress stays reachable from the nav either way.
 * Same outlined circle as the other nav buttons, with the picture filling it.
 */
import { useEffect, useState } from 'react';
import { withBase } from '../../lib/paths';
import { getProfile, SESSION_CHANGED_EVENT, SESSION_REPLACED_EVENT } from '../../lib/storage/session';
import type { ProfileInfo } from '../../types/profile';

interface Props {
  active?: boolean;
  /** Drop the chip's own outline (it sits inside the save button's merged capsule). */
  bare?: boolean;
}

export default function ProfileChip({ active = false, bare = false }: Props) {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    const refresh = () => setProfile(getProfile());
    refresh();
    // Instant on local edits (e.g. a new avatar) and cloud updates; the poll catches other tabs.
    window.addEventListener(SESSION_CHANGED_EVENT, refresh);
    window.addEventListener(SESSION_REPLACED_EVENT, refresh);
    const interval = setInterval(refresh, 2500);
    return () => {
      clearInterval(interval);
      window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
      window.removeEventListener(SESSION_REPLACED_EVENT, refresh);
    };
  }, []);

  const outline = bare
    ? 'border-transparent bg-transparent'
    : active
      ? 'border-ink-faint bg-surface-sunken'
      : 'border-border bg-surface-base hover:border-ink-faint';

  return (
    <a
      href={withBase('/progress/')}
      title={profile ? `${profile.name}: progress & profile` : 'Progress: load or create your profile'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-pill border text-ink-soft no-underline transition-[border-color,background-color] duration-300 max-[374px]:h-8 max-[374px]:w-8 sm:h-10 sm:w-10 ${outline}`}
    >
      {profile?.avatar.kind === 'photo' ? (
        <img src={profile.avatar.dataUrl} alt="" className="h-full w-full object-cover" />
      ) : profile ? (
        <span className="text-[1.15rem] leading-none sm:text-xl" aria-hidden="true">
          {profile.avatar.value}
        </span>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )}
    </a>
  );
}
