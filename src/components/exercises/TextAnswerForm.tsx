/** Free-text answer form shared by fill-blank, error-correction and sentence-transformation. */
import { useState } from 'react';
import { CharPalette, SubmitButton, textInputClass } from './ui';

interface Props {
  placeholder?: string;
  grade: (answer: string) => boolean;
  onGraded: (correct: boolean) => void;
}

export function TextAnswerForm({ placeholder = 'Type your answer…', grade, onGraded }: Props) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const answered = result !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answered || !value.trim()) return;
    const correct = grade(value);
    setResult(correct);
    onGraded(correct);
  };

  return (
    <form onSubmit={submit}>
      <div className="flex gap-3">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={answered}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={[
            textInputClass,
            result === true && 'border-success bg-success-bg text-success',
            result === false && 'border-error bg-error-bg text-error line-through',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {!answered && <SubmitButton disabled={!value.trim()} />}
      </div>
      <CharPalette disabled={answered} />
    </form>
  );
}
