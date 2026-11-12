// src/bulk/BulkScreen.tsx: Add many at once, at #/add/many (#/add/many?folder=<id> from a coin folder). Full-screen like Add, the step
// name as the prompt: Fronts (one photo of the coins laid out, the coins found outlined and numbered), Flip (a card: turn each coin
// over where it lies) and Backs (the fronts' circles as ghost rings to hold the phone by, then the same check, and the count must
// equal the fronts'). Then Review, a stub for now: it says how many coins and stores nothing. The group photos are held in memory
// only; nothing is stored or sent here.
import { useRef, useState } from 'react';
import { grabFrame, useCamera } from '../capture';
import { useFolder } from '../data/repositories';
import { addFolderIdOf, folderHash, navigate, useAddress } from '../nav/route';
import { useAlive } from '../ui/useAlive';
import { useObjectUrl } from '../ui/useObjectUrl';
import type { Circle } from './find';
import { lookAtPhoto, type Look } from './look';
import { BACKS_CAPTION, FLIP_TEXT, FRONTS_CAPTION, MOST_COINS, STEP_NAME, judge, type Step } from './steps';

/** A group photo kept for the next steps: the picture at full size and what is in it. Memory only. */
export interface Group {
  photo: Blob;
  look: Look;
}

/** A photo just taken: kept with its look and the preview the outlines are drawn on. */
interface Taken extends Group {
  preview: Blob | null;
}

const CLOSE = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/60 text-2xl';

function Header({ step, caption, onClose }: { step: Step; caption: string; onClose: () => void }) {
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

/** Rings drawn over a picture of `look`'s size, which is shown whole (contain) the way the picture is, so a ring sits on its coin and no coin is cropped away. */
function Rings({ look, circles, kind, testId }: { look: Look; circles: Circle[]; kind: 'found' | 'ghost' | 'touching'; testId?: string }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${look.width} ${look.height}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full">
      {circles.map((c, i) => (
        <g key={i} data-testid={testId}>
          <circle
            cx={c.x}
            cy={c.y}
            r={c.r}
            fill={kind === 'ghost' ? 'rgba(255,255,255,0.06)' : 'none'}
            stroke={kind === 'touching' ? '#f59e0b' : '#ffffff'}
            strokeOpacity={kind === 'ghost' ? 0.55 : 0.95}
            strokeWidth={kind === 'ghost' ? 2 : 3}
            strokeDasharray={kind === 'touching' ? '10 8' : undefined}
            vectorEffect="non-scaling-stroke"
          />
          {kind === 'touching' ? null : (
            <text
              x={c.x}
              y={c.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={c.r * 0.6}
              fontWeight={600}
              fill="#ffffff"
              fillOpacity={kind === 'ghost' ? 0.7 : 1}
              stroke="#000000"
              strokeOpacity={0.7}
              strokeWidth={c.r * 0.09}
              paintOrder="stroke"
            >
              {i + 1}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** The dashed guide over the Fronts viewfinder: four coins across, three down. */
function Guide() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div data-testid="guide" className="grid aspect-[4/3] w-[94%] grid-cols-4 grid-rows-3 gap-2">
        {Array.from({ length: MOST_COINS }, (_, i) => (
          <div key={i} data-testid="guide-cell" className="aspect-square self-center rounded-full border-2 border-dashed border-white/60" />
        ))}
      </div>
    </div>
  );
}

/** The camera for one group photo (Fronts or Backs) and the check after it. `ghosts` are the fronts, drawn faint on the Backs viewfinder. */
function Shoot({ step, ghosts, onNext, onClose }: { step: 'fronts' | 'backs'; ghosts: Look | null; onNext: (group: Group) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, error, takePhoto } = useCamera(videoRef, 'sensor');
  const stillHere = useAlive();
  const [taken, setTaken] = useState<Taken | null>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const previewUrl = useObjectUrl(taken?.preview ?? undefined);
  const verdict = taken ? judge(taken.look, ghosts ? ghosts.coins.length : null) : null;

  const read = async (photo: Blob) => {
    setReading(true);
    setProblem(null);
    try {
      const { look, preview } = await lookAtPhoto(photo);
      if (stillHere()) setTaken({ photo, look, preview });
    } catch {
      if (stillHere()) setProblem('Could not read that photo. Try again.');
    } finally {
      if (stillHere()) setReading(false);
    }
  };

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || reading) return;
    navigator.vibrate?.(15);
    try {
      // the sensor's own picture where the browser has it, else a copy of the video's frame at its own size
      const sensor = await takePhoto();
      if (sensor) return void (await read(sensor));
      const frame = grabFrame(video);
      const blob = await new Promise<Blob | null>((resolve) => frame.toBlob(resolve, 'image/jpeg', 0.92));
      frame.width = 0;
      frame.height = 0;
      if (!blob) throw new Error('no picture');
      await read(blob);
    } catch {
      if (stillHere()) setProblem('Could not keep that photo. Try again.');
    }
  };

  const retake = () => {
    setTaken(null);
    setProblem(null);
  };

  return (
    <>
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" playsInline muted />
      {taken ? (
        <>
          {previewUrl ? <img src={previewUrl} alt="The photo of the coins" draggable={false} className="absolute inset-0 h-full w-full bg-black object-contain" /> : <div className="absolute inset-0 bg-black" />}
          <Rings look={taken.look} circles={taken.look.coins} kind="found" testId="outline" />
          {taken.look.touching.length > 0 ? <Rings look={taken.look} circles={taken.look.touching} kind="touching" /> : null}
        </>
      ) : ghosts ? (
        <Rings look={ghosts} circles={ghosts.coins} kind="ghost" testId="ghost-ring" />
      ) : (
        <Guide />
      )}

      <Header step={step} caption={step === 'fronts' ? FRONTS_CAPTION : BACKS_CAPTION} onClose={onClose} />
      <div className="relative z-10 space-y-2 px-4">
        {error ? (
          <p role="alert" className="rounded-xl bg-black/70 p-3 text-base">
            {error}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="rounded-xl bg-black/70 p-3 text-base">
            {problem}
          </p>
        ) : null}
        {reading ? (
          <p role="status" className="rounded-xl bg-black/70 p-3 text-xl font-semibold">
            Looking for the coins…
          </p>
        ) : null}
        {verdict && !reading ? (
          <div role="status" className="rounded-xl bg-black/75 p-3">
            <p data-testid="line" className={`text-2xl font-semibold ${verdict.canGo ? '' : 'text-amber-300'}`}>
              {verdict.line}
            </p>
            {verdict.note ? (
              <p data-testid="note" className="mt-1 text-base text-amber-300">
                {verdict.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="relative z-10 space-y-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {taken ? (
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={retake} className="min-h-14 flex-1 rounded-2xl border border-white/50 text-lg font-semibold">
              Retake
            </button>
            {verdict?.canGo ? (
              <button type="button" onClick={() => onNext({ photo: taken.photo, look: taken.look })} className="min-h-14 flex-1 rounded-2xl bg-accent text-lg font-semibold text-accent-fg">
                Next
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <label className="flex min-h-14 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-white/50 text-lg font-semibold">
              Use a photo
              <input
                type="file"
                accept="image/*"
                data-testid="gallery-input"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void read(file);
                }}
              />
            </label>
            <button
              type="button"
              aria-label="Take photo"
              disabled={!ready || reading}
              onClick={() => void shoot()}
              className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border-4 border-white bg-white/90 disabled:opacity-40"
            />
            <div className="flex-1" />
          </div>
        )}
      </div>
    </>
  );
}

/** Flip: no camera. One tap to go on; nothing to get wrong. */
function Flip({ onBacks, onClose }: { onBacks: () => void; onClose: () => void }) {
  return (
    <>
      <Header step="flip" caption="" onClose={onClose} />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <svg aria-hidden="true" viewBox="0 0 160 100" className="h-32 w-52">
          <circle cx="58" cy="50" r="38" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="6 6" />
          <ellipse cx="58" cy="50" rx="16" ry="38" fill="#fff" fillOpacity="0.85" />
          <path d="M112 30 A34 34 0 0 1 112 72" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <path d="M104 74 L113 72 L110 63" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-3xl font-semibold leading-snug">{FLIP_TEXT}</p>
      </div>
      <div className="relative z-10 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <button type="button" onClick={onBacks} className="min-h-16 w-full rounded-2xl bg-accent text-2xl font-semibold text-accent-fg">
          Backs
        </button>
      </div>
    </>
  );
}

/** Review, for now a stub: how many coins, and nothing stored. The next story builds the pairs, the swaps and Save. */
function ReviewStub({ coins, onClose }: { coins: number; onClose: () => void }) {
  return (
    <>
      <Header step="review" caption="" onClose={onClose} />
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <p data-testid="review-count" className="text-5xl font-semibold">
          {coins} {coins === 1 ? 'coin' : 'coins'}
        </p>
      </div>
    </>
  );
}

export function BulkScreen() {
  const folderId = addFolderIdOf(useAddress());
  const folder = useFolder(folderId ?? '');
  const [step, setStep] = useState<Step>('fronts');
  // the two group photos, in memory only; dropped when the screen closes
  const [frontsPhoto, setFrontsPhoto] = useState<Group | null>(null);
  const [backsPhoto, setBacksPhoto] = useState<Group | null>(null);

  const close = () => navigate(folderId && folder !== null ? folderHash(folderId) : '#/collection', { replace: true });

  return (
    <main aria-label="Add many at once" className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-black text-white">
      {step === 'fronts' ? (
        <Shoot
          key="fronts"
          step="fronts"
          ghosts={null}
          onClose={close}
          onNext={(group) => {
            setFrontsPhoto(group);
            setStep('flip');
          }}
        />
      ) : null}
      {step === 'flip' ? <Flip onBacks={() => setStep('backs')} onClose={close} /> : null}
      {step === 'backs' && frontsPhoto ? (
        <Shoot
          key="backs"
          step="backs"
          ghosts={frontsPhoto.look}
          onClose={close}
          onNext={(group) => {
            setBacksPhoto(group);
            setStep('review');
          }}
        />
      ) : null}
      {step === 'review' && backsPhoto ? <ReviewStub coins={backsPhoto.look.coins.length} onClose={close} /> : null}
    </main>
  );
}
