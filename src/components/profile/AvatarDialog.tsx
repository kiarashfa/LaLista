/** Change the profile picture after the profile exists (emoji or photo). */
import { useEffect, useState } from 'react';
import type { Avatar } from '../../types/profile';
import { AvatarPicker, AvatarView } from './AvatarPicker';

interface Props {
  current: Avatar;
  onSave: (avatar: Avatar) => void;
  onClose: () => void;
}

const same = (a: Avatar, b: Avatar) =>
  a.kind === b.kind && (a.kind === 'emoji' ? a.value === (b as typeof a).value : a.dataUrl === (b as typeof a).dataUrl);

export default function AvatarDialog({ current, onSave, onClose }: Props) {
  const [value, setValue] = useState<Avatar>(current);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base/75 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Change your avatar"
      onClick={onClose}
    >
      <div className="w-full max-w-[440px] rounded-lg border border-border bg-surface-raised p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <AvatarView avatar={value} size={56} />
          <div className="min-w-0">
            <p className="m-0 text-lg font-bold text-ink">Change your avatar</p>
            <p className="m-0 text-sm text-ink-soft">Pick an emoji or use a photo of your own.</p>
          </div>
        </div>
        <div className="mt-5">
          <AvatarPicker value={value} onChange={setValue} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink hover:border-ink-faint">
            Cancel
          </button>
          <button
            type="button"
            disabled={same(value, current)}
            onClick={() => onSave(value)}
            className="cursor-pointer rounded-pill bg-vocab px-5 py-2 text-sm font-bold text-white hover:bg-vocab-hover disabled:cursor-default disabled:opacity-40"
          >
            Save avatar
          </button>
        </div>
      </div>
    </div>
  );
}
