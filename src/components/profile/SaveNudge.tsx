/**
 * Post-session save reminder (SPEC §5's deliberate exception to the
 * don't-nag philosophy — unsaved progress loss is the one high-cost
 * failure mode worth a nudge). Dropped into session-complete screens.
 */
import { withBase } from '../../lib/paths';
import { useSave } from './useSave';

export default function SaveNudge() {
  const { profile, dirty, status, save, overlay } = useSave();

  if (!profile) {
    return (
      <p className="m-0 mt-3 text-xs text-ink-faint">
        Progress is auto-saved in this browser only.{' '}
        <a href={withBase('/progress/')} className="font-semibold text-ink-soft underline">
          Create a profile
        </a>{' '}
        to keep it in a file you own.
      </p>
    );
  }
  if (!dirty && !status) return null;

  return (
    <p className="m-0 mt-3 text-sm">
      {overlay}
      {status ? (
        <span className="font-semibold text-success">{status}</span>
      ) : (
        <>
          <span className="text-ink-soft">💾 Nice session — remember your file:</span>{' '}
          <button type="button" onClick={() => void save()} className="cursor-pointer font-bold text-success underline">
            Save now
          </button>
        </>
      )}
    </p>
  );
}
