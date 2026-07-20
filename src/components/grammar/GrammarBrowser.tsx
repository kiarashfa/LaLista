/**
 * Grammar hub dual view (owner refinement #6). Toggle between:
 *  - ▦ Parts — the original Part-grouped cards (server-rendered children,
 *    so the SEO surface is unchanged and works without JS);
 *  - ☰ Index — owner-picked proposal D (ledger rows with ghosted Fraunces
 *    numbers, grouped under thin Part rules, pill filters + search) with
 *    proposal C's sortable column headers.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface LessonRow {
  id: string;
  number: number;
  title: string;
  summary: string;
  level: string;
  topics: string[];
  partNumeral: string;
  partTitle: string;
  url: string;
}

interface Props {
  lessons: LessonRow[];
  children: ReactNode;
}

type View = 'parts' | 'index';
type SortField = 'number' | 'title' | 'level';

const VIEW_KEY = 'lalista:grammarView';
const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };

function levelChipClass(level: string): string {
  if (level.startsWith('A')) return 'bg-success-bg text-success';
  if (level.startsWith('B')) return 'bg-gold-bg text-gold';
  return 'bg-grammar-soft text-grammar';
}

export default function GrammarBrowser({ lessons, children }: Props) {
  const [view, setView] = useState<View>('parts');
  const [query, setQuery] = useState('');
  const [part, setPart] = useState('all');
  const [topic, setTopic] = useState('all');
  const [level, setLevel] = useState('all');
  const [sort, setSort] = useState<{ field: SortField; asc: boolean }>({ field: 'number', asc: true });

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === 'index') setView('index');
  }, []);

  const switchView = (next: View) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const parts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of lessons) if (!seen.has(l.partNumeral)) seen.set(l.partNumeral, l.partTitle);
    return [...seen.entries()];
  }, [lessons]);

  const topics = useMemo(() => [...new Set(lessons.flatMap((l) => l.topics))].sort(), [lessons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = lessons.filter(
      (l) =>
        (part === 'all' || l.partNumeral === part) &&
        (topic === 'all' || l.topics.includes(topic)) &&
        (level === 'all' || l.level === level) &&
        (!q ||
          String(l.number).includes(q) ||
          l.title.toLowerCase().includes(q) ||
          l.summary.toLowerCase().includes(q) ||
          l.topics.some((t) => t.includes(q))),
    );
    const dir = sort.asc ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.field === 'number') return (a.number - b.number) * dir;
      if (sort.field === 'title') return a.title.localeCompare(b.title) * dir;
      return ((LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9)) * dir || a.number - b.number;
    });
  }, [lessons, query, part, topic, level, sort]);

  /** Part separators only make sense in the default chapter order. */
  const grouped = sort.field === 'number' && sort.asc;

  const header = (field: SortField, label: string, extraClass = '') => (
    <button
      type="button"
      onClick={() => setSort((s) => (s.field === field ? { field, asc: !s.asc } : { field, asc: true }))}
      className={[
        'cursor-pointer text-left text-[0.68rem] font-bold tracking-[0.07em] uppercase',
        sort.field === field ? 'text-grammar' : 'text-ink-faint hover:text-ink',
        extraClass,
      ].join(' ')}
    >
      {label}
      {sort.field === field && <span className="ml-1">{sort.asc ? '↑' : '↓'}</span>}
    </button>
  );

  const selectClass =
    'cursor-pointer rounded-pill border-[1.5px] border-border bg-surface-raised px-3 py-1.5 text-[0.8rem] font-semibold text-ink-soft outline-none hover:border-grammar focus:border-grammar';

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 rounded-pill border border-border bg-surface-raised p-1 text-sm font-bold w-fit">
        <button
          type="button"
          onClick={() => switchView('parts')}
          className={`cursor-pointer rounded-pill px-4 py-1.5 ${view === 'parts' ? 'bg-grammar-soft text-grammar' : 'text-ink-faint hover:text-ink'}`}
        >
          ▦ Parts
        </button>
        <button
          type="button"
          onClick={() => switchView('index')}
          className={`cursor-pointer rounded-pill px-4 py-1.5 ${view === 'index' ? 'bg-grammar-soft text-grammar' : 'text-ink-faint hover:text-ink'}`}
        >
          ☰ Index
        </button>
      </div>

      {view === 'parts' ? (
        children
      ) : (
        <div>
          {/* Filters (proposal D pill bar) */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select value={part} onChange={(e) => setPart(e.target.value)} className={selectClass} aria-label="Filter by Part">
              <option value="all">Part: all</option>
              {parts.map(([numeral, title]) => (
                <option key={numeral} value={numeral}>
                  {numeral} · {title}
                </option>
              ))}
            </select>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={selectClass} aria-label="Filter by topic">
              <option value="all">Topic: all</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass} aria-label="Filter by level">
              <option value="all">Level: all</option>
              {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search chapters…"
              className="min-w-[140px] flex-1 rounded-pill border-[1.5px] border-border bg-surface-raised px-4 py-1.5 text-[0.85rem] text-ink outline-none placeholder:text-ink-faint focus:border-grammar sm:max-w-[220px] sm:flex-none sm:ml-auto"
            />
          </div>

          {/* Sortable column headers (proposal C) */}
          <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b-2 border-border pb-2 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
            <span className="text-right">{header('number', '№')}</span>
            {header('title', 'Chapter')}
            {header('level', 'Level')}
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">No chapters match — loosen a filter or clear the search.</p>
          ) : (
            <div>
              {filtered.map((l, i) => {
                const showRule = grouped && (i === 0 || filtered[i - 1].partNumeral !== l.partNumeral);
                return (
                  <div key={l.id}>
                    {showRule && (
                      <p className="mt-5 mb-1 flex items-center gap-2 text-[0.72rem] font-bold tracking-[0.09em] text-grammar uppercase after:h-px after:flex-1 after:bg-border">
                        Part {l.partNumeral} · {l.partTitle}
                      </p>
                    )}
                    <a
                      href={l.url}
                      className="group grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 py-2 no-underline sm:grid-cols-[64px_minmax(0,1fr)_auto]"
                    >
                      <span className="font-display text-right text-[1.8rem] leading-none font-light text-grammar opacity-20 transition-opacity group-hover:opacity-60 sm:text-[2rem]">
                        {l.number}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-ink group-hover:text-grammar">{l.title}</span>
                        <span className="block truncate text-[0.82rem] text-ink-faint">{l.summary}</span>
                      </span>
                      <span className={`rounded-pill px-2 py-0.5 text-[0.62rem] font-extrabold ${levelChipClass(l.level)}`}>{l.level}</span>
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-right text-xs text-ink-faint">
            showing {filtered.length} of {lessons.length} chapters
          </p>
        </div>
      )}
    </div>
  );
}
