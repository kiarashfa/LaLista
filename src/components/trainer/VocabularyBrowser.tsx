/**
 * Vocabulary hub dual view (owner improvement #4) — the coral sibling of
 * GrammarBrowser: ▦ Groups (the server-rendered topic cards, passed as
 * children) / ☰ Index (ledger rows with ghosted numbers, sortable headers,
 * search). Search reaches INSIDE groups: typing "rojo" finds Colors.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface GroupRow {
  slug: string;
  title: string;
  count: number;
  url: string;
  /** 1-based position in the curriculum order. */
  index: number;
  /** First few Spanish words, for the row's preview line. */
  preview: string;
  /** Lowercased haystack: title + every Spanish and English word in the group. */
  blob: string;
}

interface Props {
  groups: GroupRow[];
  children: ReactNode;
}

type View = 'groups' | 'index';
type SortField = 'index' | 'title' | 'count';

const VIEW_KEY = 'lalista:vocabView';

export default function VocabularyBrowser({ groups, children }: Props) {
  const [view, setView] = useState<View>('groups');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: SortField; asc: boolean }>({ field: 'index', asc: true });

  useEffect(() => {
    if (localStorage.getItem(VIEW_KEY) === 'index') setView('index');
  }, []);

  const switchView = (next: View) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = groups.filter((g) => !q || g.blob.includes(q));
    const dir = sort.asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.field === 'index') return (a.index - b.index) * dir;
      if (sort.field === 'title') return a.title.localeCompare(b.title) * dir;
      return (a.count - b.count) * dir || a.index - b.index;
    });
  }, [groups, query, sort]);

  const header = (field: SortField, label: string) => (
    <button
      type="button"
      onClick={() => setSort((s) => (s.field === field ? { field, asc: !s.asc } : { field, asc: true }))}
      className={[
        'cursor-pointer text-left text-[0.68rem] font-bold tracking-[0.07em] uppercase',
        sort.field === field ? 'text-vocab' : 'text-ink-faint hover:text-ink',
      ].join(' ')}
    >
      {label}
      {sort.field === field && <span className="ml-1">{sort.asc ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div>
      <div className="mb-6 flex w-fit items-center gap-1 rounded-pill border border-border bg-surface-raised p-1 text-sm font-bold">
        <button
          type="button"
          onClick={() => switchView('groups')}
          className={`cursor-pointer rounded-pill px-4 py-1.5 ${view === 'groups' ? 'bg-vocab-soft text-vocab' : 'text-ink-faint hover:text-ink'}`}
        >
          ▦ Groups
        </button>
        <button
          type="button"
          onClick={() => switchView('index')}
          className={`cursor-pointer rounded-pill px-4 py-1.5 ${view === 'index' ? 'bg-vocab-soft text-vocab' : 'text-ink-faint hover:text-ink'}`}
        >
          ☰ Index
        </button>
      </div>

      {view === 'groups' ? (
        children
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search groups — or any word, e.g. “rojo”…"
              className="w-full max-w-[340px] rounded-pill border-[1.5px] border-border bg-surface-raised px-4 py-1.5 text-[0.85rem] text-ink outline-none placeholder:text-ink-faint focus:border-vocab"
            />
            <span className="ml-auto text-xs text-ink-faint">search looks inside every group's words</span>
          </div>

          <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b-2 border-border pb-2 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
            <span className="text-right">{header('index', '№')}</span>
            {header('title', 'Group')}
            {header('count', 'Words')}
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">No group contains that — try another spelling.</p>
          ) : (
            filtered.map((g) => (
              <a
                key={g.slug}
                href={g.url}
                className="group grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 py-2 no-underline sm:grid-cols-[64px_minmax(0,1fr)_auto]"
              >
                <span className="font-display text-right text-[1.8rem] leading-none font-light text-vocab opacity-20 transition-opacity group-hover:opacity-60 sm:text-[2rem]">
                  {g.index}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink group-hover:text-vocab">{g.title}</span>
                  <span className="block truncate text-[0.82rem] text-ink-faint">{g.preview}</span>
                </span>
                <span className="rounded-pill bg-vocab-soft px-2 py-0.5 text-[0.62rem] font-extrabold text-vocab">{g.count}</span>
              </a>
            ))
          )}

          <p className="mt-4 text-right text-xs text-ink-faint">
            showing {filtered.length} of {groups.length} groups
          </p>
        </div>
      )}
    </div>
  );
}
