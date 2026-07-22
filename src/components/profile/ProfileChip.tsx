/**
 * Nav avatar chip — the profile picture doubles as the link to the
 * Progress page. Shows a neutral silhouette until a profile is created
 * or loaded, so Progress stays reachable from the nav either way.
 */
import { useEffect, useState } from 'react';
import { withBase } from '../../lib/paths';
import { getProfile } from '../../lib/storage/session';
import type { ProfileInfo } from '../../types/profile';
import { AvatarView } from './AvatarPicker';

export default function ProfileChip({ active = false }: { active?: boolean }) {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    const refresh = () => setProfile(getProfile());
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <a
      href={withBase('/progress/')}
      title={profile ? `${profile.name} — progress & profile` : 'Progress — load or create your profile'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill no-underline sm:h-10 sm:w-10 ${active ? 'bg-surface-sunken' : 'hover:bg-surface-sunken'}`}
    >
      {profile ? (
        <AvatarView avatar={profile.avatar} size={32} />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-pill border border-border bg-surface-base text-ink-soft" aria-hidden="true">
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </span>
      )}
    </a>
  );
}
