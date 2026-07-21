/**
 * One play button per audio file that exists. The WordReference recordings
 * (`<id>_1.mp3`) are published and are the DEFAULT voice — the big button
 * and the auto-play target. Lingua Libre and TTS remain one click away.
 */
import { useEffect, useRef } from 'react';
import { audioUrl } from '../../lib/paths';
import type { Word } from '../../types/word';

interface Voice {
  file: string;
  label: string;
  title: string;
}

/** Priority order: WordReference → Lingua Libre → TTS (first = default). */
export function voicesFor(word: Word): Voice[] {
  const voices: Voice[] = [];
  if (word.audio.wordreference) voices.push({ file: word.audio.wordreference, label: 'WR', title: 'WordReference recording' });
  if (word.audio.linguaLibre) voices.push({ file: word.audio.linguaLibre, label: 'Native', title: 'Lingua Libre volunteer recording' });
  voices.push({ file: word.audio.tts, label: 'TTS', title: 'Piper text-to-speech (Castilian)' });
  return voices;
}

export function WordAudioButtons({ word, autoPlayFirst = false }: { word: Word; autoPlayFirst?: boolean }) {
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const voices = voicesFor(word);

  const play = (file: string) => {
    playerRef.current?.pause();
    const audio = new Audio(audioUrl(file));
    playerRef.current = audio;
    void audio.play().catch(() => {});
  };

  useEffect(() => {
    if (autoPlayFirst && voices.length) play(voices[0].file);
    return () => playerRef.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  return (
    <span className="inline-flex items-center gap-2">
      {voices.map((v, i) => (
        <button
          key={v.file}
          type="button"
          onClick={() => play(v.file)}
          title={v.title}
          className={
            i === 0
              ? 'flex h-12 w-12 cursor-pointer items-center justify-center rounded-pill bg-ink text-surface-base shadow-md hover:opacity-85'
              : 'flex h-8 cursor-pointer items-center gap-1 rounded-pill border border-border bg-surface-base px-2.5 text-xs font-bold text-ink-soft hover:border-vocab hover:text-vocab'
          }
        >
          <svg className={i === 0 ? 'ml-0.5 h-5 w-5' : 'h-3 w-3'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v13.72L19 12 8 5.14z"></path>
          </svg>
          {i > 0 && v.label}
        </button>
      ))}
    </span>
  );
}
