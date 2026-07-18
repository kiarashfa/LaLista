/**
 * The lesson-end CTA implementing SPEC §6's read gate: a manual "I've read
 * this" action (deliberately bypassable — a speed bump, not enforcement).
 * Returning users with the lesson already read see zero friction.
 */
import { useEffect, useState } from 'react';
import { getLessonProgress, markLessonRead } from '../../lib/storage/session';

interface Props {
  lessonId: string;
  workbookUrl: string;
  exerciseCount: number;
  typesPreview: string;
}

export default function ReadGateCta({ lessonId, workbookUrl, exerciseCount, typesPreview }: Props) {
  const [read, setRead] = useState<boolean | null>(null);

  useEffect(() => {
    setRead(Boolean(getLessonProgress(lessonId).readAt));
  }, [lessonId]);

  return (
    <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-md border-[1.5px] border-dashed border-grammar px-6 py-5">
      <div>
        <p className="m-0 font-bold text-ink">Ready to practice?</p>
        <p className="m-0 mt-0.5 text-sm text-ink-faint">
          {exerciseCount} exercises · {typesPreview}
        </p>
      </div>
      {read === null ? (
        <span className="h-11 w-44 animate-pulse rounded-pill bg-surface-sunken" aria-hidden="true" />
      ) : read ? (
        <span className="flex items-center gap-3">
          <span className="rounded-pill bg-success-bg px-3 py-1 text-xs font-bold text-success">Read ✓</span>
          <a href={workbookUrl} className="rounded-pill bg-grammar px-6 py-3 text-sm font-bold text-white no-underline hover:bg-grammar-hover">
            Start workbook →
          </a>
        </span>
      ) : (
        <span className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              markLessonRead(lessonId);
              setRead(true);
            }}
            className="cursor-pointer rounded-pill bg-grammar px-6 py-3 text-sm font-bold text-white hover:bg-grammar-hover"
          >
            I've read this chapter ✓
          </button>
          <span className="text-xs text-ink-faint">unlocks the workbook — one click, not a test</span>
        </span>
      )}
    </div>
  );
}
