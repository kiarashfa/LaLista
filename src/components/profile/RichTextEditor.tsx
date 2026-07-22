/**
 * Minimal rich-text editor for the notepad tabs: bold / italic / underline
 * over a contentEditable surface. Output is sanitized to a tiny HTML
 * subset (src/lib/richtext.ts) before it ever reaches the save file.
 * Uncontrolled after mount — remount (key) it to show a different value.
 */
import { useEffect, useRef, useState } from 'react';
import { isRichEmpty, sanitizeRichText, toEditableHtml } from '../../lib/richtext';

interface Props {
  initial: string;
  /** Debounced; receives sanitized HTML. */
  onChange: (html: string) => void;
  placeholder: string;
  ariaLabel: string;
}

type Command = 'bold' | 'italic' | 'underline';

const BUTTONS: { cmd: Command; label: string; title: string; className: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
  { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', className: 'italic' },
  { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
];

export default function RichTextEditor({ initial, onChange, placeholder, ariaLabel }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const [empty, setEmpty] = useState(() => isRichEmpty(initial));
  const [active, setActive] = useState<Record<Command, boolean>>({ bold: false, italic: false, underline: false });

  useEffect(() => {
    if (editor.current) editor.current.innerHTML = toEditableHtml(initial);
    setEmpty(isRichEmpty(editor.current?.innerHTML ?? ''));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Mount only — uncontrolled afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reflect the caret's formatting in the toolbar's pressed states. */
  const readState = () => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    } catch {
      // queryCommandState can throw on detached selections — keep last state
    }
  };

  const emit = () => {
    const html = editor.current?.innerHTML ?? '';
    setEmpty(isRichEmpty(html));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(sanitizeRichText(html)), 500);
  };

  const exec = (cmd: Command) => {
    editor.current?.focus();
    // Deprecated but universally supported — exactly right for a
    // three-button formatter (and it keeps native Ctrl+B/I/U in sync).
    document.execCommand(cmd);
    readState();
    emit();
  };

  return (
    <div className="rounded-md border-2 border-border bg-surface-raised focus-within:border-gold">
      <div className="flex gap-1 border-b border-border px-2 py-1.5" role="toolbar" aria-label="Text formatting">
        {BUTTONS.map(({ cmd, label, title, className }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={active[cmd]}
            // preventDefault so the click never steals the text selection.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm text-sm ${className} ${active[cmd] ? 'bg-gold-bg text-gold' : 'text-ink-soft hover:bg-surface-sunken hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative">
        {empty && (
          <p className="pointer-events-none absolute top-3 left-4 m-0 pr-4 text-[0.95rem] text-ink-faint" aria-hidden="true">
            {placeholder}
          </p>
        )}
        <div
          ref={editor}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={emit}
          onKeyUp={readState}
          onMouseUp={readState}
          onFocus={readState}
          className="min-h-[7rem] px-4 py-3 text-[0.95rem] leading-relaxed text-ink outline-none"
        />
      </div>
    </div>
  );
}
