/**
 * Group Study session queue (SPEC §10) — a within-session pacing device,
 * deliberately not persisted:
 *
 *  - New words are introduced in batches of 3 study cards.
 *  - The first batch quizzes only a SUBSET (2 of 3) — never study-3-quiz-3
 *    back to back, which would test recency rather than recall.
 *  - Later batches quiz all 3, interleaved with words pulled back from
 *    earlier batches THIS session (rising quiz-to-study ratio).
 *  - Wrong/skipped words re-surface a few cards later, same session.
 *  - Session-scoped only: never reaches into other sessions' due words
 *    beyond the due pool it was constructed with.
 */
import { shuffle } from '../shuffle';

export interface QueueItem {
  wordId: string;
  kind: 'study' | 'quiz';
}

export interface SessionQueueInput {
  /** Stage-New word ids, in display order — candidates for introduction. */
  newWords: string[];
  /** Already-started words currently due for quizzing (incl. difficult). */
  dueWords: string[];
  /** Difficult-bucket members among all words (quizzed more often in-session). */
  difficult: Set<string>;
  rng?: () => number;
}

const BATCH_SIZE = 3;
const REINSERT_OFFSET = 3;

export class SessionQueue {
  private upcoming: QueueItem[] = [];
  private newRemaining: string[];
  private dueRemaining: string[];
  private difficult: Set<string>;
  private introducedThisSession: string[] = [];
  private batchNumber = 0;
  private rng: () => number;

  constructor(input: SessionQueueInput) {
    this.newRemaining = [...input.newWords];
    this.dueRemaining = shuffle(input.dueWords);
    this.difficult = new Set(input.difficult);
    this.rng = input.rng ?? Math.random;
    // Lead with due words (past-session material) before introducing new ones.
    for (const id of this.dueRemaining.splice(0, Math.min(4, this.dueRemaining.length))) {
      this.upcoming.push({ wordId: id, kind: 'quiz' });
    }
  }

  /** Next card, or null when the session is complete. */
  next(): QueueItem | null {
    if (this.upcoming.length === 0) this.refill();
    return this.upcoming.shift() ?? null;
  }

  peekHasMore(): boolean {
    return this.upcoming.length > 0 || this.newRemaining.length > 0 || this.dueRemaining.length > 0;
  }

  /**
   * Report a quiz outcome. Wrong/skip → the word re-surfaces a few cards
   * later (kept in-session regardless of what storage decided about dates).
   */
  report(wordId: string, outcome: 'correct' | 'wrong' | 'skip'): void {
    if (outcome === 'correct') return;
    const at = Math.min(REINSERT_OFFSET, this.upcoming.length);
    this.upcoming.splice(at, 0, { wordId, kind: 'quiz' });
  }

  /** Remove a word from this session entirely (e.g. marked as known). */
  retire(wordId: string): void {
    this.upcoming = this.upcoming.filter((i) => i.wordId !== wordId);
    this.newRemaining = this.newRemaining.filter((w) => w !== wordId);
    this.dueRemaining = this.dueRemaining.filter((w) => w !== wordId);
    this.introducedThisSession = this.introducedThisSession.filter((w) => w !== wordId);
  }

  /** Sidebar jump: put a specific word up next (study if never introduced+new). */
  jumpTo(wordId: string, isNew: boolean): void {
    this.upcoming = this.upcoming.filter((i) => i.wordId !== wordId);
    this.newRemaining = this.newRemaining.filter((w) => w !== wordId);
    if (isNew && !this.introducedThisSession.includes(wordId)) {
      // Study card first, quiz shortly after.
      this.upcoming.unshift({ wordId, kind: 'study' }, { wordId, kind: 'quiz' });
      this.introducedThisSession.push(wordId);
    } else {
      this.upcoming.unshift({ wordId, kind: 'quiz' });
    }
  }

  private refill(): void {
    if (this.newRemaining.length > 0) {
      const batch = this.newRemaining.splice(0, BATCH_SIZE);
      for (const id of batch) this.upcoming.push({ wordId: id, kind: 'study' });

      // First batch: quiz a strict subset. Later batches: quiz all.
      const quizCount = this.batchNumber === 0 ? Math.max(1, batch.length - 1) : batch.length;
      const toQuiz = shuffle(batch).slice(0, quizCount);

      // Interleave with earlier-session material — prioritize difficult words.
      const backCatalog = shuffle(
        this.introducedThisSession.filter((w) => !batch.includes(w)),
      ).sort((a, b) => Number(this.difficult.has(b)) - Number(this.difficult.has(a)));
      const pulls = backCatalog.slice(0, Math.min(this.batchNumber, 2, backCatalog.length));

      const interleaved: QueueItem[] = [];
      const quizzes = shuffle(toQuiz);
      while (quizzes.length || pulls.length) {
        if (quizzes.length) interleaved.push({ wordId: quizzes.shift()!, kind: 'quiz' });
        if (pulls.length) interleaved.push({ wordId: pulls.shift()!, kind: 'quiz' });
      }
      this.upcoming.push(...interleaved);

      this.introducedThisSession.push(...batch);
      this.batchNumber += 1;
    } else if (this.dueRemaining.length > 0) {
      for (const id of this.dueRemaining.splice(0, 6)) {
        this.upcoming.push({ wordId: id, kind: 'quiz' });
      }
    }
  }
}
