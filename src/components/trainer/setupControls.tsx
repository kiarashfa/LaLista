/**
 * Shared setup controls for the Review and Test islands:
 * — ModePicker: multi-select direction cards (mix any of the four).
 * — ScopePicker: all Mastered words (default), or one topic group with a
 *   mastered-only / every-word choice.
 * Words excluded via the eye-off toggle never enter any pool.
 */
import type { VocabWordProgress } from '../../types/progress';
import type { Word } from '../../types/word';
import { ALL_MODES, MODE_INFO, type QuizMode } from './wordUtils';

/** 'all' = every Mastered word site-wide; otherwise a topic-group slug. */
export type Scope = 'all' | string;
/** Within a group: only its Mastered words, or every word it contains. */
export type PoolKind = 'mastered' | 'all';

export interface GroupOption {
  slug: string;
  title: string;
  /** Words in the group net of user-excluded ones. */
  total: number;
  /** Mastered words in the group net of user-excluded ones. */
  mastered: number;
}

const isEligible = (p: VocabWordProgress | undefined) => !p?.excluded;
const isMastered = (p: VocabWordProgress | undefined) => p?.stage === 6 && !p.excluded;

export function groupOptionsFor(
  words: Word[],
  groups: { slug: string; title: string }[],
  progress: Record<string, VocabWordProgress>,
): GroupOption[] {
  return groups.map((g) => {
    const inGroup = words.filter((w) => w.group === g.slug);
    return {
      slug: g.slug,
      title: g.title,
      total: inGroup.filter((w) => isEligible(progress[w.id])).length,
      mastered: inGroup.filter((w) => isMastered(progress[w.id])).length,
    };
  });
}

export function masteredCount(words: Word[], progress: Record<string, VocabWordProgress>): number {
  return words.filter((w) => isMastered(progress[w.id])).length;
}

/** The words a session with this scope/kind would draw from (unshuffled). */
export function buildPool(
  words: Word[],
  progress: Record<string, VocabWordProgress>,
  scope: Scope,
  poolKind: PoolKind,
): Word[] {
  const inScope = scope === 'all' ? words : words.filter((w) => w.group === scope);
  if (scope !== 'all' && poolKind === 'all') return inScope.filter((w) => isEligible(progress[w.id]));
  return inScope.filter((w) => isMastered(progress[w.id]));
}

// ---------- ModePicker ----------

export function ModePicker({ modes, onChange }: { modes: QuizMode[]; onChange: (modes: QuizMode[]) => void }) {
  const toggle = (m: QuizMode) => onChange(modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALL_MODES.map((m) => {
        const on = modes.includes(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(m)}
            className={`cursor-pointer rounded-md border-2 p-3 text-left ${on ? 'border-vocab bg-vocab-soft' : 'border-border hover:border-ink-faint'}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold text-ink">{MODE_INFO[m].title}</span>
              <span
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-pill border text-[0.65rem] font-bold ${on ? 'border-vocab bg-vocab text-white' : 'border-border text-transparent'}`}
                aria-hidden="true"
              >
                ✓
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">{MODE_INFO[m].desc}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- ScopePicker ----------

interface ScopeProps {
  groups: GroupOption[];
  masteredTotal: number;
  scope: Scope;
  poolKind: PoolKind;
  onScope: (scope: Scope) => void;
  onPoolKind: (kind: PoolKind) => void;
}

export function ScopePicker({ groups, masteredTotal, scope, poolKind, onScope, onPoolKind }: ScopeProps) {
  const group = scope === 'all' ? null : (groups.find((g) => g.slug === scope) ?? null);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-pressed={scope === 'all'}
        onClick={() => onScope('all')}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border-2 p-3 text-left ${scope === 'all' ? 'border-vocab bg-vocab-soft' : 'border-border hover:border-ink-faint'}`}
      >
        <span>
          <span className="font-bold text-ink">All Mastered words</span>
          <span className="mt-0.5 block text-xs text-ink-soft">Everything you've mastered, across every group.</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-ink-soft">{masteredTotal}</span>
      </button>

      <div className={`rounded-md border-2 p-3 ${group ? 'border-vocab bg-vocab-soft' : 'border-border'}`}>
        <label className="block font-bold text-ink" htmlFor="scope-group">
          One topic group
        </label>
        <select
          id="scope-group"
          value={group ? scope : ''}
          onChange={(e) => onScope(e.target.value === '' ? 'all' : e.target.value)}
          className="mt-2 w-full cursor-pointer rounded-md border-2 border-border bg-surface-base px-3 py-2 text-sm text-ink outline-none focus:border-vocab"
        >
          <option value="">Choose a group…</option>
          {groups.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.title} — {g.mastered}/{g.total} mastered
            </option>
          ))}
        </select>
        {group && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={poolKind === 'mastered'}
              onClick={() => onPoolKind('mastered')}
              className={`cursor-pointer rounded-pill border-2 px-3.5 py-1.5 text-xs font-bold ${poolKind === 'mastered' ? 'border-vocab bg-surface-raised text-vocab' : 'border-border text-ink-soft hover:border-ink-faint'}`}
            >
              Mastered only · {group.mastered}
            </button>
            <button
              type="button"
              aria-pressed={poolKind === 'all'}
              onClick={() => onPoolKind('all')}
              className={`cursor-pointer rounded-pill border-2 px-3.5 py-1.5 text-xs font-bold ${poolKind === 'all' ? 'border-vocab bg-surface-raised text-vocab' : 'border-border text-ink-soft hover:border-ink-faint'}`}
            >
              Every word · {group.total}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
