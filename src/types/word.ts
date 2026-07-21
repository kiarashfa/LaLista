/**
 * Vocabulary types — the compiled shape of src/content/vocabulary/words.json.
 * Source of truth is data/vocabulary/master.xlsx (gitignored, hand-maintained);
 * scripts/convert-vocab.ts produces the JSON. Never hand-edit the compiled output.
 */

/** Normalized from the workbook's Spanish bracket abbreviations ([sust.] → noun, etc.). */
export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'noun-adjective';

/**
 * Beyond masc/fem/null, the workbook also carries neut ([neut.]),
 * invariable ([invar.]) and dual-gender ([masc./fem.], e.g. el/la estudiante).
 */
export type Gender = 'masc' | 'fem' | 'neut' | 'invariable' | 'masc-fem' | null;

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface WordAudio {
  /**
   * WordReference recording (`<id>_1.mp3`). Personal use only — the files are
   * gitignored and never published; the UI only offers this voice
   * when the PERSONAL_AUDIO env flag is on.
   */
  wordreference: string | null;
  /** Lingua Libre recording (`<id>_2.mp3`) — CC-BY-4.0, speakers credited in audio-credits.md. */
  linguaLibre: string | null;
  /** Piper TTS es_ES-davefx-medium (`<id>_3.mp3`) — present for every word. */
  tts: string;
}

export interface Word {
  /** Stable, group-prefixed id from workbook column A. Also the audio filename stem and the SRS progress key. */
  id: string;
  spanish: string;
  english: string;
  /** IPA (Castilian), null for the ~100 words without one. */
  phonetics: string | null;
  partOfSpeech: PartOfSpeech;
  gender: Gender;
  /** Topic-group slug, e.g. "travel-transportation". */
  group: string;
  cefr: CefrLevel;
  /** Example sentence from the workbook; the target word is wrapped in **double asterisks**. */
  example: string;
  /** Register tag from the workbook's Note column, e.g. "(informal)". */
  registerNote: string | null;
  audio: WordAudio;
  /** Human-written hint shown proactively in the trainer. */
  disambiguationNote: string | null;
  /** Ids of words sharing the same English translation (exact match) plus manual additions. */
  relatedWords: string[];
}

export interface WordGroup {
  slug: string;
  /** Display title — the workbook sheet name, e.g. "Travel and Transportation". */
  title: string;
  count: number;
}
