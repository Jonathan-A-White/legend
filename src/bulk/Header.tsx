// The top of each Add many at once step: the step's name as the big prompt, a caption under it, and Close.
import { STEP_NAME, type Step } from './steps';

const CLOSE = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/60 text-2xl';

export function Header({ step, caption, onClose }: { step: Step; caption: string; onClose: () => void }) {
  return (
    <div className="relative z-10 bg-gradient-to-b from-black/80 to-transparent pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
      <div className="flex items-start justify-between gap-3 px-4">
        <div>
          <p data-testid="prompt" aria-live="polite" className="text-4xl font-semibold tracking-wide">
            {STEP_NAME[step]}
          </p>
          <p className="text-base text-white/80">{caption}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className={CLOSE}>
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
