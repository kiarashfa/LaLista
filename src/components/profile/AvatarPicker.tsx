/** Avatar choice: emoji OR uploaded photo — offer both. */
import { useRef, useState } from 'react';
import type { Avatar } from '../../types/profile';

const EMOJI = ['🦊', '🐸', '🦉', '🐙', '🌵', '🌞', '🌙', '⚡', '🍊', '🫒', '🐚', '🎨', '🎸', '🚲', '🏔️', '☕'];

export function AvatarView({ avatar, size = 48 }: { avatar: Avatar; size?: number }) {
  return avatar.kind === 'photo' ? (
    <img src={avatar.dataUrl} alt="" width={size} height={size} className="rounded-pill object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center rounded-pill bg-surface-sunken"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      {avatar.value}
    </span>
  );
}

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      onChange({ kind: 'photo', dataUrl: canvas.toDataURL('image/jpeg', 0.82) });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setPhotoError("Couldn't read that image — try a different file.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange({ kind: 'emoji', value: e })}
            aria-label={`avatar ${e}`}
            className={[
              'flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-2 text-xl',
              value.kind === 'emoji' && value.value === e ? 'border-vocab bg-vocab-soft' : 'border-border bg-surface-raised hover:border-ink-faint',
            ].join(' ')}
          >
            {e}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={[
            'flex h-10 cursor-pointer items-center gap-2 rounded-pill border-2 px-3 text-sm font-semibold',
            value.kind === 'photo' ? 'border-vocab bg-vocab-soft text-vocab' : 'border-border text-ink-soft hover:border-ink-faint',
          ].join(' ')}
        >
          {value.kind === 'photo' && <AvatarView avatar={value} size={26} />}
          {value.kind === 'photo' ? 'Change photo' : '📷 Use a photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
      {photoError && <p className="m-0 mt-2 text-xs text-error">{photoError}</p>}
    </div>
  );
}
