import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { teams } from '../data/teams';
import BaseballCard from './BaseballCard';
import Baseball from './Baseball';

// ---------------------------------------------------------------------------
// Flow: Name (1st) → Team (2nd) → Photo (3rd) → Swing (home) → Generating → Card
//
// The AI portrait starts generating as soon as the photo is taken, so it runs
// while the player swings. The swing is analyzed by vision/swing_vision.py
// (MoveNet) through /api/analyze-swing, and its stats go on the card.
// ---------------------------------------------------------------------------

type Step = 'name' | 'team' | 'photo' | 'swing' | 'generating' | 'card';

const BASES: { step: Step; label: string; base: string }[] = [
  { step: 'name', label: 'Name', base: '1st' },
  { step: 'team', label: 'Team', base: '2nd' },
  { step: 'photo', label: 'Photo', base: '3rd' },
  { step: 'swing', label: 'Swing', base: 'Home' },
];

type CardData = {
  nickname: string;
  position: string;
  stats: Record<string, string>;
  funFact: string;
};

type SwingResult = {
  person_detected?: boolean;
  swing_detected: boolean;
  message?: string;
  metrics?: Record<string, number>;
  scores?: Record<string, number>;
  stats?: Record<string, string>;
  archetype?: string;
};

type ImageJob = {
  image: string;
  promise: Promise<{ stylizedImage: string | null; card: CardData | null }>;
};

const SWING_SECONDS = 3;
const SWING_FPS = 20;

const defaultStats: CardData = {
  nickname: 'The Baseball King',
  position: 'Designated Viber',
  stats: { AVG: '.342', HR: '24', RBI: '89', SB: '15', OPS: '.892', WAR: '4.2' },
  funFact: 'Once hit a home run while eating a hot dog.',
};

const LOADING_LINES = [
  'Warming up in the bullpen…',
  'Checking the radar gun…',
  'Scouts are taking notes…',
  'Signing your rookie contract…',
  'Printing your card…',
];

const MAX_NAME = 24;

export default function CardBuilder() {
  // Flow
  const [step, setStep] = useState<Step>('name');
  const [leaving, setLeaving] = useState(false);
  const [pitching, setPitching] = useState(false);

  // Player data
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('Dodgers');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stylizedImage, setStylizedImage] = useState<string | null>(null);
  const [generatedStats, setGeneratedStats] = useState(defaultStats);
  const [jerseyNumber, setJerseyNumber] = useState(() => randomNumber());
  const [swing, setSwing] = useState<SwingResult | null>(null);
  const imageJob = useRef<ImageJob | null>(null);

  // UI
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);

  const colors = teams[team];

  // -------------------------------------------------------------------------
  // Navigation with an exit animation
  // -------------------------------------------------------------------------
  const goTo = useCallback((next: Step) => {
    setLeaving(true);
    window.setTimeout(() => {
      setStep(next);
      setLeaving(false);
      window.scrollTo({ top: 0 });
    }, 320);
  }, []);

  const submitName = () => {
    if (!playerName.trim()) return;
    setPitching(true);
    window.setTimeout(() => setPitching(false), 800);
    goTo('team');
  };

  const startOver = () => {
    setPlayerName('');
    setTeam('Dodgers');
    setOriginalImage(null);
    setStylizedImage(null);
    setGeneratedStats(defaultStats);
    setJerseyNumber(randomNumber());
    setSwing(null);
    imageJob.current = null;
    setError(null);
    setShowOriginal(false);
    goTo('name');
  };

  // -------------------------------------------------------------------------
  // Card generation
  // -------------------------------------------------------------------------

  // Start the AI portrait in the background (once per photo) so it's ready by the time
  // the player finishes swinging.
  const startImageJob = (image: string) => {
    if (imageJob.current?.image === image) return;
    const promise = fetch('/api/generate-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: image, team, playerName: playerName.trim() }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || 'Generation failed');
      return { stylizedImage: data.stylizedImage ?? null, card: data.stats ?? null };
    });
    promise.catch(() => {}); // handled when the card is assembled
    imageJob.current = { image, promise };
  };

  const photoDone = () => {
    if (!originalImage) return;
    startImageJob(originalImage);
    goTo('swing');
  };

  // Combine the AI portrait with the swing stats (or the API's surprise stats if skipped)
  const finishCard = async (swingResult: SwingResult | null) => {
    if (!originalImage) return;
    setSwing(swingResult);
    setError(null);
    goTo('generating');
    startImageJob(originalImage); // no-op if already running

    try {
      const { stylizedImage: img, card } = await imageJob.current!.promise;
      setStylizedImage(img);
      setGeneratedStats(cardFromSwing(card ?? defaultStats, swingResult));
      setShowOriginal(false);
      goTo('card');
    } catch (err) {
      console.error('API error:', err);
      imageJob.current = null;
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      goTo('photo');
    }
  };

  // Rotate the loading messages while generating
  useEffect(() => {
    if (step !== 'generating') return;
    setLoadingLine(0);
    const id = window.setInterval(() => setLoadingLine((n) => (n + 1) % LOADING_LINES.length), 2200);
    return () => window.clearInterval(id);
  }, [step]);

  const baseIndex =
    step === 'generating' ? 3 : step === 'card' ? 4 : BASES.findIndex((b) => b.step === step);

  return (
    <div className="relative min-h-screen font-ui">
      <Ballpark />

      {pitching && (
        <div className="pitch-ball">
          <Baseball size={90} />
        </div>
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar: title + base-path progress */}
        <header className="flex items-center justify-between gap-4 px-6 pt-5 sm:px-10">
          <button
            onClick={step === 'name' ? undefined : startOver}
            className="flex items-center gap-3 text-left"
            aria-label="Start over"
          >
            <Baseball size={40} className="ball-spin" />
            <span className="leading-none">
              <span className="block font-script text-2xl text-[var(--gold)]">The Rookie</span>
              <span className="block font-display text-lg tracking-widest text-[var(--chalk)]">CARD SHOP</span>
            </span>
          </button>
          <BasePath index={baseIndex} />
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div key={step} className={`w-full ${leaving ? 'screen-out' : 'screen-in'}`}>
            {step === 'name' && (
              <NameScreen
                name={playerName}
                onChange={setPlayerName}
                onSubmit={submitName}
              />
            )}
            {step === 'team' && (
              <TeamScreen
                name={playerName}
                team={team}
                onSelect={setTeam}
                onBack={() => goTo('name')}
                onNext={() => goTo('photo')}
              />
            )}
            {step === 'photo' && (
              <PhotoScreen
                image={originalImage}
                onImage={(img) => {
                  setOriginalImage(img);
                  setStylizedImage(null);
                  setError(null);
                }}
                error={error}
                onBack={() => goTo('team')}
                onNext={photoDone}
              />
            )}
            {step === 'swing' && (
              <SwingScreen
                name={playerName}
                onBack={() => goTo('photo')}
                onDone={finishCard}
              />
            )}
            {step === 'generating' && (
              <GeneratingScreen name={playerName} line={LOADING_LINES[loadingLine]} />
            )}
            {step === 'card' && (
              <CardScreen
                name={playerName}
                team={team}
                colors={colors}
                originalImage={originalImage}
                stylizedImage={stylizedImage}
                showOriginal={showOriginal}
                setShowOriginal={setShowOriginal}
                stats={generatedStats}
                swing={swing}
                number={jerseyNumber}
                onStartOver={startOver}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Use the team's accent color for text unless it is hard to read on the primary color
function readableOn(bg: string, preferred: string) {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  if (contrast(bg, preferred) >= 3) return preferred;
  return contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111';
}

function randomNumber() {
  return String(Math.floor(Math.random() * 98) + 1).padStart(2, '0');
}

// Put the MoveNet swing stats on the card; keep the AI's nickname.
function cardFromSwing(base: CardData, swing: SwingResult | null): CardData {
  if (!swing?.swing_detected || !swing.stats) return base;
  const m = swing.metrics ?? {};
  const facts = [
    m.bat_speed_mph_est != null && `an estimated ${Math.round(m.bat_speed_mph_est)} mph bat speed`,
    m.shoulder_turn_deg >= 10 && `${Math.round(m.shoulder_turn_deg)}° of shoulder turn`,
  ].filter(Boolean);
  return {
    nickname: base.nickname,
    position: swing.archetype || base.position,
    stats: swing.stats,
    funFact: facts.length ? `Clocked ${facts.join(' with ')} at the plate.` : base.funFact,
  };
}

// ---------------------------------------------------------------------------
// Webcam (shared by the photo and swing screens)
// ---------------------------------------------------------------------------

type CameraStatus = 'off' | 'starting' | 'on' | 'error';

function useCamera(autoStart: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('off');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus('off');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      return;
    }
    setStatus('starting');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
        audio: false,
      });
      setStatus('on');
    } catch (err) {
      console.warn('Camera unavailable:', err);
      setStatus('error');
    }
  }, []);

  // Start on arrival (if asked) and always release the camera on leave
  useEffect(() => {
    if (autoStart) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback ref: hook the stream up as soon as the <video> appears
  const attach = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  return { videoRef, attach, status, start, stop };
}

// Grab the current video frame as a JPEG data URL, scaled to maxWidth
function grabFrame(video: HTMLVideoElement, maxWidth: number, quality: number, mirror = false) {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

function Ballpark() {
  return (
    <div className="ballpark" aria-hidden="true">
      <div className="light-tower left" />
      <div className="light-tower right" />
      <div className="field" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress diamond
// ---------------------------------------------------------------------------

// SVG positions of 1st, 2nd, 3rd, home
const BASE_POS = [
  { x: 52, y: 30 },
  { x: 30, y: 8 },
  { x: 8, y: 30 },
  { x: 30, y: 52 },
];

function BasePath({ index }: { index: number }) {
  const runner = BASE_POS[Math.min(3, Math.max(0, index))];
  const diamond = (x: number, y: number, r: number) =>
    `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;

  return (
    <div className="flex items-center gap-3">
      <ol className="hidden text-right text-xs uppercase tracking-[0.2em] sm:block">
        {BASES.map((b, i) => (
          <li
            key={b.step}
            className={
              i === index ? 'text-[var(--gold)]' : i < index ? 'text-[var(--chalk)]' : 'text-[var(--chalk-dim)] opacity-60'
            }
          >
            {b.base} · {b.label}
          </li>
        ))}
      </ol>
      <svg width="64" height="64" viewBox="0 0 60 60" aria-label={`Step ${Math.min(index + 1, 4)} of 4`}>
        <polygon points={diamond(30, 30, 22)} fill="rgba(31,107,53,0.6)" stroke="rgba(246,241,228,0.7)" strokeWidth="1.5" />
        {BASE_POS.map((p, i) => (
          <polygon
            key={i}
            points={diamond(p.x, p.y, 5)}
            className={`base ${i < index ? 'done' : i === index ? 'current' : ''}`}
            fill="rgba(246,241,228,0.35)"
          />
        ))}
        <g className="runner" style={{ transform: `translate(${runner.x}px, ${runner.y}px)` }}>
          <circle r="3.2" fill="#d0202e" stroke="#fff" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Name
// ---------------------------------------------------------------------------

function NameScreen({
  name,
  onChange,
  onSubmit,
}: {
  name: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="stagger mx-auto flex max-w-3xl flex-col items-center text-center">
      <div className="ball-float mb-2">
        <Baseball size={110} className="ball-spin" />
      </div>
      <p className="font-script text-4xl text-[var(--gold)] sm:text-5xl">Batter up!</p>
      <h1 className="chalk-glow font-display text-5xl uppercase leading-none tracking-wide sm:text-7xl">
        Step up to the plate
      </h1>

      <form
        className="scoreboard mt-8 w-full max-w-2xl px-6 pb-8 pt-5 sm:px-10"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="bulb-row mb-4">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
        <label htmlFor="player-name" className="block text-sm uppercase tracking-[0.3em] text-[var(--chalk-dim)]">
          Now batting
        </label>
        <input
          id="player-name"
          ref={inputRef}
          className="name-input mt-2"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="off"
          spellCheck={false}
          placeholder="Your name"
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="mt-3 text-xs uppercase tracking-[0.25em] text-[var(--chalk-dim)]">
          {name.trim() ? 'Press Enter or tap Play Ball' : 'Type the name for your card'}
        </p>
      </form>

      <button className="btn-play mt-8" disabled={!name.trim()} onClick={onSubmit}>
        Play ball ⚾
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Team
// ---------------------------------------------------------------------------

function TeamScreen({
  name,
  team,
  onSelect,
  onBack,
  onNext,
}: {
  name: string;
  team: string;
  onSelect: (t: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
      <p className="font-script text-3xl text-[var(--gold)] sm:text-4xl">Welcome, {name.trim()}!</p>
      <h1 className="chalk-glow font-display text-4xl uppercase tracking-wide sm:text-6xl">Pick your team</h1>
      <p className="mt-2 text-[var(--chalk-dim)]">Your card will be printed in their colors.</p>

      <div className="mt-8 grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(teams).map(([t, c], i) => (
          <button
            key={t}
            onClick={() => onSelect(t)}
            onDoubleClick={() => {
              onSelect(t);
              onNext();
            }}
            className={`pennant-wrap ${t === team ? 'selected' : ''}`}
            aria-pressed={t === team}
          >
            <span
              className="pennant w-full"
              style={
                {
                  background: c.primary,
                  color: readableOn(c.primary, c.accent),
                  '--pennant-stripe': c.secondary,
                  animationDelay: `${i * 25}ms`,
                } as React.CSSProperties
              }
            >
              {t}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-4">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-play" onClick={onNext}>
          Go {team} →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Photo (webcam with countdown, or upload)
// ---------------------------------------------------------------------------

function PhotoScreen({
  image,
  onImage,
  error,
  onBack,
  onNext,
}: {
  image: string | null;
  onImage: (img: string | null) => void;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { videoRef, attach, status: camera, start: startCamera, stop: stopCamera } = useCamera(!image);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [dragging, setDragging] = useState(false);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    // Mirrored so the photo matches what the person saw on screen
    const img = grabFrame(video, 1024, 0.9, true);
    if (!img) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 500);
    onImage(img);
    stopCamera();
  };

  const startCountdown = () => {
    let n = 3;
    setCountdown(n);
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        setCountdown(null);
        capture();
      } else {
        setCountdown(n);
      }
    }, 1000);
  };

  const readFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onImage(reader.result as string);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    onImage(null);
    startCamera();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
      <p className="font-script text-3xl text-[var(--gold)] sm:text-4xl">Say cheese!</p>
      <h1 className="chalk-glow font-display text-4xl uppercase tracking-wide sm:text-6xl">Strike a pose</h1>
      <p className="mt-2 text-[var(--chalk-dim)]">
        {image ? 'Looking like a pro. Ready to print?' : 'Show us your best batting stance.'}
      </p>

      <div
        className={`viewfinder mt-6 aspect-[4/3] w-full max-w-xl ${dragging ? 'ring-4 ring-[var(--gold)]' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readFile(e.dataTransfer.files?.[0]);
        }}
      >
        {image ? (
          <img src={image} alt="Your photo" className="h-full w-full object-cover" />
        ) : camera === 'on' ? (
          <video ref={attach} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--chalk-dim)]">
            <Baseball size={70} className={camera === 'starting' ? 'ball-spin fast' : 'ball-float'} />
            <p className="max-w-xs">
              {camera === 'starting'
                ? 'Warming up the camera…'
                : camera === 'error'
                  ? 'No camera found. Upload a photo instead, or drop one here.'
                  : 'Camera is off.'}
            </p>
          </div>
        )}

        {countdown !== null && (
          <div key={countdown} className="countdown">
            {countdown}
          </div>
        )}
        {flash && <div className="flash" />}

        {/* home-plate frame guide */}
        {!image && camera === 'on' && countdown === null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-xs uppercase tracking-[0.3em] text-white/80">
            Center yourself in the frame
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => readFile(e.target.files?.[0])}
      />

      {error && (
        <div className="mt-5 w-full max-w-xl rounded-lg border border-red-500/60 bg-red-900/40 p-3 text-sm text-red-100">
          Rain delay! {error} Try again.
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button className="btn-ghost" onClick={onBack}>← Back</button>

        {!image && camera === 'on' && (
          <button className="btn-play" onClick={startCountdown} disabled={countdown !== null}>
            📸 Take photo
          </button>
        )}
        {!image && camera !== 'on' && camera !== 'starting' && (
          <button className="btn-ghost" onClick={startCamera}>Try camera</button>
        )}
        {!image && (
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Upload photo
          </button>
        )}

        {image && (
          <>
            <button className="btn-ghost" onClick={retake}>Retake</button>
            <button className="btn-play" onClick={onNext}>Next: your swing →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home: record the swing and measure it with MoveNet
// ---------------------------------------------------------------------------

type SwingPhase = 'ready' | 'countdown' | 'recording' | 'analyzing' | 'result' | 'error';

function SwingScreen({
  name,
  onBack,
  onDone,
}: {
  name: string;
  onBack: () => void;
  onDone: (swing: SwingResult | null) => void;
}) {
  const { videoRef, attach, status: camera, start: startCamera } = useCamera(true);
  const [phase, setPhase] = useState<SwingPhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SwingResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearInterval(id)), []);

  const analyze = async (frames: string[], timestamps: number[]) => {
    setPhase('analyzing');
    try {
      const response = await fetch('/api/analyze-swing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, timestamps }),
      });
      const data = await response.json();
      if (response.status === 503 || data?.error === 'tracker_offline') {
        setOffline(true);
        throw new Error("The swing tracker isn't running.");
      }
      if (!response.ok) throw new Error(data?.error || 'Swing analysis failed');
      setResult(data);
      setPhase('result');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Swing analysis failed');
      setPhase('error');
    }
  };

  const record = () => {
    const video = videoRef.current;
    if (!video) return;
    const frames: string[] = [];
    const timestamps: number[] = [];
    const t0 = performance.now();
    setPhase('recording');
    setProgress(0);
    const id = window.setInterval(() => {
      const elapsed = performance.now() - t0;
      const frame = grabFrame(video, 480, 0.75);
      if (frame) {
        frames.push(frame);
        timestamps.push(elapsed);
      }
      setProgress(Math.min(1, elapsed / (SWING_SECONDS * 1000)));
      if (elapsed >= SWING_SECONDS * 1000) {
        window.clearInterval(id);
        analyze(frames, timestamps);
      }
    }, 1000 / SWING_FPS);
    timers.current.push(id);
  };

  const begin = () => {
    setResult(null);
    setProblem(null);
    setOffline(false);
    setPhase('countdown');
    let n = 3;
    setCountdown(n);
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        record();
      } else {
        setCountdown(n);
      }
    }, 1000);
    timers.current.push(id);
  };

  const busy = phase === 'countdown' || phase === 'recording' || phase === 'analyzing';
  const swung = result?.swing_detected;
  const m = result?.metrics ?? {};

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
      <p className="font-script text-3xl text-[var(--gold)] sm:text-4xl">Bottom of the ninth, {name.trim()}</p>
      <h1 className="chalk-glow font-display text-4xl uppercase tracking-wide sm:text-6xl">Take your swing</h1>
      <p className="mt-2 text-[var(--chalk-dim)]">
        Step back so your whole body is in view. Your swing sets the stats on your card.
      </p>

      <div className="viewfinder mt-6 aspect-[4/3] w-full max-w-xl">
        {camera === 'on' ? (
          <video ref={attach} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--chalk-dim)]">
            <Baseball size={70} className={camera === 'starting' ? 'ball-spin fast' : 'ball-float'} />
            <p className="max-w-xs">
              {camera === 'starting' ? 'Warming up the camera…' : 'No camera found. You can skip the swing.'}
            </p>
          </div>
        )}

        {phase === 'countdown' && (
          <div key={countdown} className="countdown">
            {countdown}
          </div>
        )}
        {phase === 'recording' && (
          <>
            <div className="countdown swing-call">SWING!</div>
            <div className="absolute inset-x-0 bottom-0 h-2 bg-black/40">
              <div className="h-full bg-[var(--stitch)]" style={{ width: `${progress * 100}%` }} />
            </div>
          </>
        )}
        {phase === 'analyzing' && (
          <div className="absolute inset-0 grid place-items-center bg-black/55">
            <div className="flex flex-col items-center gap-3">
              <Baseball size={60} className="ball-spin fast" />
              <p className="font-display text-2xl uppercase tracking-wider">Reading your swing…</p>
            </div>
          </div>
        )}
        {phase === 'result' && result && (
          <div className="screen-in absolute inset-0 grid place-items-center bg-black/60 p-6">
            {swung ? (
              <div className="flex flex-col items-center">
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--chalk-dim)]">Bat speed</div>
                <div className="radar text-7xl">
                  {Math.round(m.bat_speed_mph_est ?? 0)}
                  <span className="ml-1 text-2xl">MPH</span>
                </div>
                <div className="headline-in mt-2 font-display text-3xl uppercase tracking-wide">{result.archetype}</div>
                <div className="mt-4 grid grid-cols-6 gap-3 text-center">
                  {Object.entries(result.stats ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--chalk-dim)]">{k}</div>
                      <div className="font-display text-xl">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-sm">
                <div className="font-display text-4xl uppercase text-[var(--gold)]">Strike one!</div>
                <p className="mt-2">{result.message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {phase === 'error' && (
        <div className="mt-5 w-full max-w-xl rounded-lg border border-red-500/60 bg-red-900/40 p-3 text-sm text-red-100">
          Rain delay! {problem}
          {offline && (
            <span className="mt-1 block text-red-200/80">
              Start it in a terminal with <code>python vision/swing_vision.py serve</code>, or skip for surprise stats.
            </span>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button className="btn-ghost" onClick={onBack} disabled={busy}>← Back</button>

        {phase === 'ready' && camera === 'on' && (
          <button className="btn-play" onClick={begin}>⚾ I'm ready</button>
        )}
        {(phase === 'result' || phase === 'error') && camera === 'on' && (
          <button className={swung ? 'btn-ghost' : 'btn-play'} onClick={begin}>
            Swing again
          </button>
        )}
        {phase === 'result' && swung && (
          <button className="btn-play" onClick={() => onDone(result)}>Make my card →</button>
        )}
        {(camera === 'error' || phase === 'error' || (phase === 'result' && !swung)) && (
          <button className="btn-ghost" onClick={() => onDone(null)}>Skip: surprise stats</button>
        )}
        {camera === 'error' && (
          <button className="btn-ghost" onClick={startCamera}>Try camera</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating: pitch, swing, radar gun
// ---------------------------------------------------------------------------

function GeneratingScreen({ name, line }: { name: string; line: string }) {
  const [mph, setMph] = useState(88);
  useEffect(() => {
    const id = window.setInterval(() => setMph(86 + Math.floor(Math.random() * 16)), 1600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <h1 className="chalk-glow font-display text-4xl uppercase tracking-wide sm:text-6xl">
        {name.trim()} is up!
      </h1>

      <div className="relative mt-6 h-64 w-full max-w-md" aria-hidden="true">
        {/* incoming pitch */}
        <div className="incoming-ball absolute left-1/2 top-1/2 -ml-6 -mt-6">
          <Baseball size={48} className="ball-spin fast" />
        </div>
        {/* bat */}
        <svg className="bat absolute left-[12%] top-[18%]" width="220" height="220" viewBox="0 0 220 220">
          <defs>
            <linearGradient id="wood" x1="0" x2="1">
              <stop offset="0" stopColor="#8a5a2b" />
              <stop offset="0.5" stopColor="#d9a463" />
              <stop offset="1" stopColor="#a8703a" />
            </linearGradient>
          </defs>
          <path
            d="M24 196 L34 190 L190 36 C 200 26, 214 32, 206 46 L 46 204 L 38 210 Z"
            fill="url(#wood)"
            stroke="#5a3814"
            strokeWidth="2"
          />
          <circle cx="30" cy="200" r="9" fill="#5a3814" />
        </svg>
      </div>

      <div className="scoreboard mt-2 flex items-center gap-6 px-8 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--chalk-dim)]">Pitch speed</div>
          <div className="radar text-5xl">{mph}<span className="ml-1 text-xl">MPH</span></div>
        </div>
      </div>

      <p key={line} className="ticker mt-6 text-xl text-[var(--chalk)]">{line}</p>
      <p className="mt-1 text-sm text-[var(--chalk-dim)]">This can take up to a minute.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home plate: the finished card
// ---------------------------------------------------------------------------

function CardScreen({
  name,
  team,
  colors,
  originalImage,
  stylizedImage,
  showOriginal,
  setShowOriginal,
  stats,
  swing,
  number,
  onStartOver,
}: {
  name: string;
  team: string;
  colors: (typeof teams)[string];
  originalImage: string | null;
  stylizedImage: string | null;
  showOriginal: boolean;
  setShowOriginal: (v: boolean) => void;
  stats: CardData;
  swing: SwingResult | null;
  number: string;
  onStartOver: () => void;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 2,
        color: [colors.primary, colors.secondary, colors.accent, '#f4b63f'][i % 4],
        rotate: Math.random() * 360,
      })),
    [colors],
  );

  const image = showOriginal ? originalImage : stylizedImage ?? originalImage;

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-center">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${c.left}vw`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}

      <div
        className="card-reveal"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({
            x: ((e.clientY - r.top) / r.height - 0.5) * -14,
            y: ((e.clientX - r.left) / r.width - 0.5) * 14,
          });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <div
          className="card-tilt"
          style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        >
          <BaseballCard
            playerImage={image}
            playerName={stats.nickname || name}
            team={team}
            colors={colors}
            position={stats.position}
            number={number}
            stats={stats.stats}
          />
        </div>
      </div>

      <div className="stagger flex max-w-md flex-col items-center text-center lg:items-start lg:text-left">
        <p className="font-script text-4xl text-[var(--gold)]">Home run!</p>
        <h1 className="headline-in chalk-glow font-display text-5xl uppercase leading-none sm:text-6xl">
          Welcome to the bigs, {name.trim()}
        </h1>
        <p className="mt-3 text-lg text-[var(--chalk-dim)]">
          #{number} · {stats.position} · {team}
        </p>

        <div className="scoreboard mt-6 w-full p-5 text-left">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--gold)]">Scouting report</div>
          <p className="mt-2 text-[var(--chalk)]">{stats.funFact}</p>
          {swing?.swing_detected && swing.metrics && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/10 pt-3 text-sm sm:grid-cols-4">
              {[
                ['Bat speed', `${Math.round(swing.metrics.bat_speed_mph_est)} mph`],
                ['Shoulder turn', `${Math.round(swing.metrics.shoulder_turn_deg)}°`],
                ['Hip turn', `${Math.round(swing.metrics.hip_turn_deg)}°`],
                ['Swing time', `${swing.metrics.swing_time_s.toFixed(2)}s`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] uppercase tracking-widest text-[var(--chalk-dim)]">{label}</dt>
                  <dd className="font-display text-lg">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!swing?.swing_detected && (
            <p className="mt-3 text-xs uppercase tracking-widest text-[var(--chalk-dim)]">Surprise stats: no swing recorded</p>
          )}
        </div>

        {stylizedImage && originalImage && (
          <div className="mt-5 flex gap-2">
            <button
              className={`btn-ghost ${!showOriginal ? '!border-[var(--gold)] !text-[var(--gold)]' : ''}`}
              onClick={() => setShowOriginal(false)}
            >
              Stylized
            </button>
            <button
              className={`btn-ghost ${showOriginal ? '!border-[var(--gold)] !text-[var(--gold)]' : ''}`}
              onClick={() => setShowOriginal(true)}
            >
              Original
            </button>
          </div>
        )}

        <button className="btn-play mt-8" onClick={onStartOver}>
          Next batter ⚾
        </button>
      </div>
    </div>
  );
}