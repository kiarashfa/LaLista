/**
 * First-exposure study card: look and listen, no possibility of a
 * wrong answer. The mark-as-difficult / mark-as-known actions live here too,
 * so a word you already know never has to survive a quiz round first.
 */
import { useEffect, useState } from 'react';
import type { Word } from '../../types/word';
import { GENDER_LABEL, POS_LABEL, renderExample } from './wordUtils';
import { WordAudioButtons } from './WordAudioButtons';
import { ConfirmDialog } from './ConfirmDialog';
import { NoteDialog } from './NoteDialog';

interface Props {
  word: Word;
  onNext: () => void;
  /** Eyebrow label — "New word" for first exposure, "Review" when revisited via the TOC. */
  eyebrow?: string;
  /** Already in the difficult bucket (renders the flag filled). */
  difficult?: boolean;
  onToggleDifficult?: () => void;
  /** Excluded from Review & Test (renders the eye-off filled). */
  excluded?: boolean;
  onToggleExcluded?: () => void;
  /** Confirmed mark-as-known — parent retires the word and advances. */
  onMarkKnown?: () => void;
  /** Personal note/mnemonic — the 📝 action next to mark-as-known. */
  note?: string;
  onSaveNote?: (text: string) => void;
}

export function StudyCard({ word, onNext, eyebrow = 'New word', difficult = false, onToggleDifficult, excluded = false, onToggleExcluded, onMarkKnown, note = '', onSaveNote }: Props) {
  const [confirmKnown, setConfirmKnown] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !confirmKnown && !noteOpen) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, confirmKnown, noteOpen]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-raised px-6 py-8 text-center shadow-lg sm:px-10">
      <span className="font-display pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-[15rem] leading-none font-light text-vocab opacity-5 select-none" aria-hidden="true">¿</span>

      <p className="relative m-0 mb-3 text-xs font-bold tracking-widest text-vocab uppercase">{eyebrow}</p>
      <p className="display-friendly relative m-0 text-4xl font-bold text-ink">{word.spanish}</p>
      {word.phonetics && <p className="relative m-0 mt-1 text-sm text-ink-faint">{word.phonetics}</p>}
      <p className="relative m-0 mt-2 text-xl text-ink-soft">{word.english}</p>

      <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-ink-soft">{POS_LABEL[word.partOfSpeech]}</span>
        {word.gender && <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-ink-soft">{GENDER_LABEL[word.gender]}</span>}
        <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-ink-faint">{word.cefr}</span>
        {word.registerNote && <span className="rounded-pill bg-gold-bg px-2.5 py-0.5 text-xs font-semibold text-gold">{word.registerNote}</span>}
      </div>

      <div className="relative mt-5 flex justify-center">
        <WordAudioButtons word={word} autoPlayFirst />
      </div>

      <p className="relative mx-auto mt-5 max-w-[420px] rounded-md bg-surface-sunken px-4 py-3 text-[0.95rem] text-ink-soft">
        {renderExample(word.example)}
      </p>

      {word.disambiguationNote && (
        <div className="relative mx-auto mt-4 flex max-w-[420px] gap-2 rounded-md border border-gold bg-gold-bg px-4 py-3 text-left text-sm text-ink-soft">
          <span aria-hidden="true">💡</span>
          <span>{word.disambiguationNote}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="relative mt-6 cursor-pointer rounded-pill bg-vocab px-8 py-3 text-sm font-bold text-white hover:bg-vocab-hover"
      >
        Next <span className="ml-1 rounded-[4px] bg-white/20 px-1.5 py-0.5 text-[0.68rem]">↵</span>
      </button>

      {(onToggleDifficult || onToggleExcluded || onMarkKnown || onSaveNote) && (
        <div className="relative mt-4 flex justify-center gap-3">
          {onToggleDifficult && (
            <button
              type="button"
              title={difficult ? 'Difficult — click to unmark' : 'Mark as difficult'}
              aria-label={difficult ? 'Unmark difficult' : 'Mark as difficult'}
              aria-pressed={difficult}
              onClick={onToggleDifficult}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] ${difficult ? 'border-error text-error' : 'border-border text-ink-faint hover:border-error hover:text-error'}`}
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill={difficult ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 21V4m0 11h13l-2.5-4.5L17 6H4"></path>
              </svg>
            </button>
          )}
          {onToggleExcluded && (
            <button
              type="button"
              title={excluded ? 'Excluded from Review & Test — click to include' : 'Exclude from Review & Test'}
              aria-label={excluded ? 'Include in Review and Test' : 'Exclude from Review and Test'}
              aria-pressed={excluded}
              onClick={onToggleExcluded}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] ${excluded ? 'border-ink-soft bg-surface-sunken text-ink' : 'border-border text-ink-faint hover:border-ink-soft hover:text-ink'}`}
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.4 18.4 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"></path>
                <path d="m2 2 20 20"></path>
              </svg>
            </button>
          )}
          {onMarkKnown && (
            <button
              type="button"
              title="Mark as known"
              aria-label="Mark as known — jump straight to Mastered"
              onClick={() => setConfirmKnown(true)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] border-border text-ink-faint hover:border-success hover:text-success"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m2 13 4 4L14 9m4-2-8.5 8.5"></path>
              </svg>
            </button>
          )}
          {onSaveNote && (
            <button
              type="button"
              title={note ? 'Edit your note' : 'Add a note (mnemonic)'}
              aria-label={note ? 'Edit your note for this word' : 'Add a note for this word'}
              aria-pressed={!!note}
              onClick={() => setNoteOpen(true)}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] ${note ? 'border-gold text-gold' : 'border-border text-ink-faint hover:border-gold hover:text-gold'}`}
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
              </svg>
            </button>
          )}
        </div>
      )}

      {noteOpen && onSaveNote && (
        <NoteDialog spanish={word.spanish} initial={note} onSave={onSaveNote} onClose={() => setNoteOpen(false)} />
      )}

      {confirmKnown && onMarkKnown && (
        <ConfirmDialog
          title={`Mark “${word.spanish}” as known?`}
          body="This jumps the word straight to Mastered — it leaves your study rotation here and shows up in Review and Test instead. You can undo it right after, or demote it later by answering it wrong in Group Study."
          confirmLabel="Yes, I know it"
          onConfirm={() => {
            setConfirmKnown(false);
            onMarkKnown();
          }}
          onCancel={() => setConfirmKnown(false)}
        />
      )}
    </div>
  );
}
