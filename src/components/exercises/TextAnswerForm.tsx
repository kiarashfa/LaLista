/**
 * Free-text answer form shared by fill-blank, error-correction and
 * sentence-transformation. Implements the tilde-forgiveness flow: an
 * accent-only miss isn't wrong — it triggers ONE retry
 * ("type it with the tilde", answer not revealed, so typing the accented form
 * is the learning act). Fixed on retry → full correct. Still accent-off →
 * counted correct, but the exact spelling is shown and flagged.
 */
import { useState } from 'react';
import type { TypedGrade } from '../../lib/grading/graders';
import { CharPalette, SubmitButton, textInputClass } from './ui';

interface Props {
  placeholder?: string;
  grade: (answer: string) => TypedGrade;
  /** The exact expected answer — shown only in the post-grade teaching line. */
  expected: string;
  onGraded: (correct: boolean) => void;
}

type Phase = 'input' | 'retry' | 'done';

export function TextAnswerForm({ placeholder = 'Type your answer…', grade, expected, onGraded }: Props) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [final, setFinal] = useState<TypedGrade | null>(null);
  const done = phase === 'done';

  const finish = (result: TypedGrade) => {
    setPhase('done');
    setFinal(result);
    onGraded(result !== 'wrong');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (done || !value.trim()) return;
    const result = grade(value);
    if (phase === 'input') {
      if (result === 'accent') setPhase('retry');
      else finish(result);
    } else {
      // Retry: exact fixes it fully; anything else is forgiven but taught.
      finish(result === 'correct' ? 'correct' : 'accent');
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="flex gap-3">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={done}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={[
            textInputClass,
            phase === 'retry' && 'border-warning bg-gold-bg',
            final === 'correct' && 'border-success bg-success-bg text-success',
            final === 'accent' && 'border-warning bg-gold-bg text-warning',
            final === 'wrong' && 'border-error bg-error-bg text-error line-through',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {!done && <SubmitButton>{phase === 'retry' ? 'Check again' : 'Check'}</SubmitButton>}
      </div>

      {phase === 'retry' && (
        <p className="m-0 mt-2 rounded-md border border-warning bg-gold-bg px-3 py-2 text-sm text-ink-soft">
          <b className="text-warning">¡Casi!</b> That's the right word — it's just missing an accent mark. Type it once
          more <b>with the tilde</b> (the ´ button below helps).
        </p>
      )}
      {final === 'accent' && (
        <p className="m-0 mt-2 rounded-md border border-warning bg-gold-bg px-3 py-2 text-sm text-ink-soft">
          Counted as correct — but the exact spelling is <b className="text-ink">{expected}</b>. Tildes are part of the
          word, and sometimes the meaning (<i>estas</i> “these” ≠ <i>estás</i> “you are”).
        </p>
      )}

      <CharPalette disabled={done} />
    </form>
  );
}
