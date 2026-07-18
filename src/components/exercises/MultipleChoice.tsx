import { useMemo } from 'react';
import { shuffle } from '../../lib/shuffle';
import type { GenderAgreementExercise, MultipleChoiceExercise } from '../../types/exercises';
import { ChoiceGrid } from './ChoiceGrid';

interface Props {
  exercise: MultipleChoiceExercise;
  onGraded: (correct: boolean) => void;
}

export function MultipleChoice({ exercise, onGraded }: Props) {
  const options = useMemo(() => shuffle(exercise.options), [exercise]);
  return <ChoiceGrid options={options} correct={exercise.correctAnswer} onGraded={(ok) => onGraded(ok)} />;
}

/** Gender/agreement — same interaction, but the target word is displayed large (el/la choices refer to it). */
export function GenderAgreement({ exercise, onGraded }: { exercise: GenderAgreementExercise; onGraded: (correct: boolean) => void }) {
  return (
    <div>
      <p className="display-friendly mb-5 text-center text-3xl font-semibold text-ink">{exercise.word}</p>
      <ChoiceGrid options={exercise.options} correct={exercise.correctAnswer} onGraded={(ok) => onGraded(ok)} />
    </div>
  );
}
