/**
 * The Progress page's Notepad, three tabs:
 * — General: free-form notes (bold/italic/underline).
 * — Vocabulary: every per-word note added via the 📝 button on word cards,
 *   editable/removable here too. Word data is lazy-loaded on first open so
 *   the Progress bundle doesn't carry all 2001 words by default.
 * — Grammar: a second free-form pad for grammar notes.
 * Everything lives in the same save file as the rest of progress.
 */
import { useEffect, useMemo, useState } from 'react';
import { withBase } from '../../lib/paths';
import { setGrammarNotepad, setNotepad, setWordNote } from '../../lib/storage/session';
import type { VocabWordProgress } from '../../types/progress';
import type { Word, WordGroup } from '../../types/word';
import RichTextEditor from './RichTextEditor';

type Tab = 'general' | 'vocabulary' | 'grammar';

interface Props {
  notepad: string;
  grammarNotepad: string;
  vocabulary: Record<string, VocabWordProgress>;
}

const TAB_LABEL: Record<Tab, string> = { general: 'General', vocabulary: 'Vocabulary', grammar: 'Grammar' };

export default function Notepad({ notepad, grammarNotepad, vocabulary }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  // Local copy so edits/removals in this tab reflect immediately.
  const [vocab, setVocab] = useState(vocabulary);
  const [wordIndex, setWordIndex] = useState<Map<string, Word> | null>(null);
  const [groupTitles, setGroupTitles] = useState<Map<string, string>>(new Map());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const noted = useMemo(
    () =>
      Object.entries(vocab)
        .filter(([, p]) => p.note)
        .map(([id, p]) => ({ id, note: p.note! })),
    [vocab],
  );

  // Lazy-load the word list the first time the Vocabulary tab opens.
  useEffect(() => {
    if (tab !== 'vocabulary' || wordIndex) return;
    void Promise.all([import('../../content/vocabulary/words.json'), import('../../content/vocabulary/groups.json')]).then(
      ([wordsMod, groupsMod]) => {
        setWordIndex(new Map((wordsMod.default as unknown as Word[]).map((w) => [w.id, w])));
        setGroupTitles(new Map((groupsMod.default as WordGroup[]).map((g) => [g.slug, g.title])));
      },
    );
  }, [tab, wordIndex]);

  const rows = useMemo(() => {
    if (!wordIndex) return [];
    return noted
      .map(({ id, note }) => ({ id, note, word: wordIndex.get(id) }))
      .sort((a, b) =>
        a.word && b.word
          ? a.word.group.localeCompare(b.word.group) || a.word.spanish.localeCompare(b.word.spanish, 'es')
          : a.id.localeCompare(b.id),
      );
  }, [noted, wordIndex]);

  const saveEdit = (id: string) => {
    const updated = setWordNote(id, draft);
    setVocab((v) => ({ ...v, [id]: updated }));
    setEditing(null);
  };

  const removeNote = (id: string) => {
    const updated = setWordNote(id, '');
    setVocab((v) => ({ ...v, [id]: updated }));
    if (editing === id) setEditing(null);
  };

  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <h2 className="m-0 mr-3 text-sm font-bold tracking-wide text-ink-soft uppercase">Notepad</h2>
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-pill border-2 px-3.5 py-1 text-xs font-bold ${tab === t ? 'border-gold bg-gold-bg text-gold' : 'border-border text-ink-soft hover:border-ink-faint'}`}
          >
            {TAB_LABEL[t]}
            {t === 'vocabulary' && noted.length > 0 && <span className="ml-1.5 opacity-70">{noted.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <RichTextEditor
          initial={notepad}
          onChange={setNotepad}
          ariaLabel="General notes"
          placeholder="Jot anything — tricks, words to ask about, favorite sentences. Lives in your save file."
        />
      )}

      {tab === 'grammar' && (
        <RichTextEditor
          initial={grammarNotepad}
          onChange={setGrammarNotepad}
          ariaLabel="Grammar notes"
          placeholder="Your own grammar cheat-sheet — rules that finally clicked, endings to remember, ser vs estar tricks…"
        />
      )}

      {tab === 'vocabulary' &&
        (noted.length === 0 ? (
          <div className="rounded-md border-2 border-border bg-surface-raised px-5 py-6 text-center">
            <p className="m-0 text-sm leading-relaxed text-ink-soft">
              No word notes yet. Every word card in{' '}
              <a href={withBase('/vocabulary/')} className="font-semibold text-ink underline">
                Group Study
              </a>{' '}
              has a ✏️ button — mnemonics you add there collect here.
            </p>
          </div>
        ) : !wordIndex ? (
          <p className="m-0 rounded-md border-2 border-border bg-surface-raised px-5 py-6 text-center text-sm text-ink-faint">
            Loading your words…
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map(({ id, note, word }) => (
              <li key={id} className="rounded-md border border-border bg-surface-raised px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {word ? (
                    <>
                      <a href={withBase(`/vocabulary/${word.group}/`)} className="font-bold text-ink no-underline hover:text-vocab">
                        {word.spanish}
                      </a>
                      <span className="text-sm text-ink-faint">{word.english}</span>
                      <span className="ml-auto text-xs text-ink-faint">{groupTitles.get(word.group) ?? word.group}</span>
                    </>
                  ) : (
                    <span className="font-bold text-ink">{id}</span>
                  )}
                </div>
                {editing === id ? (
                  <div className="mt-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      maxLength={500}
                      autoFocus
                      // Put the caret at the END of the note, not the start.
                      onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                      className="w-full rounded-md border-2 border-border bg-surface-base px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="cursor-pointer rounded-pill border-2 border-border px-3 py-1 text-xs font-bold text-ink hover:border-ink-faint"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(id)}
                        className="cursor-pointer rounded-pill bg-gold px-3 py-1 text-xs font-bold text-white hover:opacity-90"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">{note}</p>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        title="Edit note"
                        aria-label={`Edit note for ${word?.spanish ?? id}`}
                        onClick={() => {
                          setEditing(id);
                          setDraft(note);
                        }}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm text-ink-faint hover:bg-surface-sunken hover:text-ink"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Remove note"
                        aria-label={`Remove note for ${word?.spanish ?? id}`}
                        onClick={() => removeNote(id)}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm text-ink-faint hover:bg-surface-sunken hover:text-error"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
