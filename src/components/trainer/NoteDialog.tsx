/**
 * In-card editor for a word's personal note/mnemonic (the 📝 action on
 * study and quiz cards). Plain text; shows up again in the Progress
 * page's Notepad → Vocabulary tab. Key events never escape the dialog —
 * Esc/Enter/number-key shortcuts on the card underneath stay quiet.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  spanish: string;
  initial: string;
  /** Called with the new text; '' removes the note. */
  onSave: (text: string) => void;
  onClose: () => void;
}

export function NoteDialog({ spanish, initial, onSave, onClose }: Props) {
  const [text, setText] = useState(initial);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  const save = () => {
    onSave(text);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-surface-base/85 p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-label={`Note for ${spanish}`}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="w-full max-w-[400px] rounded-md border border-border bg-surface-raised p-5 text-left shadow-lg">
        <p className="m-0 font-bold text-ink">Note for “{spanish}”</p>
        <p className="m-0 mt-1 text-xs leading-relaxed text-ink-soft">
          A mnemonic, a rhyme, anything that makes it stick — it also shows up in your Progress notepad.
        </p>
        <textarea
          ref={textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="e.g. “sounds like…”"
          className="mt-3 w-full rounded-md border-2 border-border bg-surface-base px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {initial.trim() !== '' && (
            <button
              type="button"
              onClick={() => {
                onSave('');
                onClose();
              }}
              className="mr-auto cursor-pointer rounded-pill border-2 border-border px-3 py-1.5 text-xs font-bold text-error hover:border-error"
            >
              Remove note
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink hover:border-ink-faint"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="cursor-pointer rounded-pill bg-vocab px-4 py-2 text-sm font-bold text-white hover:bg-vocab-hover"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
