/** Shared UI primitives for the workbook exercise components. */
import type { ReactNode } from 'react';

export function KbdBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-surface-sunken text-[0.72rem] font-bold text-ink-faint">
      {children}
    </span>
  );
}

export function SubmitButton({ children = 'Check', disabled = false }: { children?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="cursor-pointer rounded-pill bg-grammar px-6 py-2.5 text-sm font-bold text-white hover:bg-grammar-hover disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Spanish character palette for US keyboards. Inserts into the currently
 * focused input/textarea at the caret, using the native value setter so React
 * controlled inputs receive a real input event. onMouseDown preventDefault
 * keeps focus in the input.
 */
const CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'];

function insertAtCaret(char: string) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + char + el.value.slice(end);
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.setSelectionRange(start + char.length, start + char.length);
}

export function CharPalette({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label="Spanish characters">
      {CHARS.map((c) => (
        <button
          key={c}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAtCaret(c)}
          className="h-7 w-7 cursor-pointer rounded-sm border border-border bg-surface-raised text-sm text-ink-soft hover:border-grammar hover:text-grammar disabled:cursor-default disabled:opacity-30"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export const textInputClass =
  'w-full rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 font-body text-[1.02rem] text-ink outline-none focus:border-grammar disabled:opacity-70';
