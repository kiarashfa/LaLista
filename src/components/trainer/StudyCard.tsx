/**
 * First-exposure study card (SPEC §10): look and listen, no possibility of a
 * wrong answer. Quiz-only controls (skip/difficult/known) deliberately absent.
 */
import { useEffect } from 'react';
import type { Word } from '../../types/word';
import { GENDER_LABEL, POS_LABEL, renderExample } from './wordUtils';
import { WordAudioButtons } from './WordAudioButtons';

interface Props {
  word: Word;
  onNext: () => void;
}

export function StudyCard({ word, onNext }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-raised px-6 py-8 text-center shadow-lg sm:px-10">
      <span className="font-display pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-[15rem] leading-none font-light text-vocab opacity-5 select-none" aria-hidden="true">¿</span>

      <p className="relative m-0 mb-3 text-xs font-bold tracking-widest text-vocab uppercase">New word</p>
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
    </div>
  );
}
