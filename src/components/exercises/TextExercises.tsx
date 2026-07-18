/** The three free-text exercise types, all built on TextAnswerForm. */
import { gradeErrorCorrection, gradeFillBlank, gradeSentenceTransformation } from '../../lib/grading/graders';
import type {
  ErrorCorrectionExercise,
  FillBlankExercise,
  SentenceTransformationExercise,
} from '../../types/exercises';
import { TextAnswerForm } from './TextAnswerForm';

export function FillBlank({ exercise, onGraded }: { exercise: FillBlankExercise; onGraded: (c: boolean) => void }) {
  return <TextAnswerForm placeholder="Fill in the blank…" grade={(a) => gradeFillBlank(exercise, a)} onGraded={onGraded} />;
}

export function ErrorCorrection({ exercise, onGraded }: { exercise: ErrorCorrectionExercise; onGraded: (c: boolean) => void }) {
  return (
    <div>
      <p className="mb-4 rounded-md bg-error-bg px-4 py-3 text-center text-lg font-semibold text-error line-through decoration-error/40">
        {exercise.incorrectSentence}
      </p>
      <TextAnswerForm placeholder="Type the corrected sentence…" grade={(a) => gradeErrorCorrection(exercise, a)} onGraded={onGraded} />
    </div>
  );
}

export function SentenceTransformation({
  exercise,
  onGraded,
}: {
  exercise: SentenceTransformationExercise;
  onGraded: (c: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-1 rounded-md bg-surface-sunken px-4 py-3 text-center text-lg font-semibold text-ink">{exercise.originalSentence}</p>
      <p className="mb-4 text-center text-sm font-semibold tracking-wide text-grammar uppercase">→ {exercise.instruction}</p>
      <TextAnswerForm placeholder="Type the transformed sentence…" grade={(a) => gradeSentenceTransformation(exercise, a)} onGraded={onGraded} />
    </div>
  );
}
