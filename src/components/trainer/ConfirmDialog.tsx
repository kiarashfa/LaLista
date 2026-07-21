/** Small in-card confirm used by "Mark as known". */
interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-surface-base/85 p-6 backdrop-blur-[2px]" role="alertdialog" aria-label={title}>
      <div className="max-w-[380px] rounded-md border border-border bg-surface-raised p-5 text-center shadow-lg">
        <p className="m-0 font-bold text-ink">{title}</p>
        <p className="m-0 mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink hover:border-ink-faint"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-pill bg-success px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
