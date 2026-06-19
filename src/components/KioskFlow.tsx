// src/components/KioskFlow.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { teams } from '../data/teams';
import BaseballCard from './BaseballCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'welcome'
  | 'photo'
  | 'name'
  | 'team'
  | 'sport'
  | 'action'
  | 'recording'
  | 'generating'
  | 'reveal';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface CardData {
  nickname: string;
  position: string;
  stats: Record<string, string>;
  funFact: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_ACTIONS: Record<string, { label: string; mode: string }[]> = {
  Baseball: [
    { label: 'Pitch', mode: 'pitch' },
    { label: 'Swing', mode: 'swing' },
  ],
  Soccer: [
    { label: 'Penalty Kick', mode: 'soccer_kick' },
    { label: 'Free Kick', mode: 'soccer_free' },
  ],
  Football: [
    { label: 'Throw', mode: 'football_throw' },
    { label: 'Run', mode: 'football_run' },
  ],
  Basketball: [
    { label: 'Shoot', mode: 'basketball_shoot' },
    { label: 'Dribble', mode: 'basketball_dribble' },
  ],
};

const SPORTS = Object.keys(SPORT_ACTIONS);
const TEAM_LIST = Object.keys(teams);
const RECORD_SECONDS = 5;

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_WEIGHTS = [0.5, 0.3, 0.15, 0.05];

function rollRarity(): Rarity {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < RARITIES.length; i++) {
    cumulative += RARITY_WEIGHTS[i];
    if (r < cumulative) return RARITIES[i];
  }
  return 'common';
}

// ─── Padres Palette ───────────────────────────────────────────────────────────

const P = {
  brown: '#2F241D',
  darkBrown: '#1C1714',
  deepBlack: '#0D0B09',
  gold: '#FFC425',
  goldDim: '#C49A1A',
  sand: '#EFE6D1',
  white: '#FFFFFF',
};

// ─── Global styles injected once ─────────────────────────────────────────────

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&display=swap');

  :root {
    --gold: ${P.gold};
    --gold-dim: ${P.goldDim};
    --brown: ${P.brown};
    --dark-brown: ${P.darkBrown};
    --deep-black: ${P.deepBlack};
    --sand: ${P.sand};
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${P.deepBlack};
    color: ${P.white};
    font-family: 'Barlow Condensed', sans-serif;
    overflow: hidden;
  }

  .bebas { font-family: 'Bebas Neue', sans-serif; }

  @keyframes goldShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  @keyframes foilRotate {
    0%   { filter: hue-rotate(0deg) brightness(1.1); }
    50%  { filter: hue-rotate(20deg) brightness(1.4); }
    100% { filter: hue-rotate(0deg) brightness(1.1); }
  }

  @keyframes pulseGold {
    0%, 100% { box-shadow: 0 0 12px ${P.gold}66; }
    50%       { box-shadow: 0 0 32px ${P.gold}cc, 0 0 64px ${P.gold}44; }
  }

  @keyframes cardReveal {
    0%   { opacity: 0; transform: translateY(40px) scale(0.92) rotateY(-8deg); }
    100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
  }

  @keyframes legendaryPulse {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px ${P.gold}88); }
    50%       { filter: brightness(1.15) drop-shadow(0 0 32px ${P.gold}ff); }
  }

  @keyframes dotBounce {
    0%, 80%, 100% { transform: translateY(0); }
    40%           { transform: translateY(-8px); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .shimmer-text {
    background: linear-gradient(90deg, ${P.goldDim}, ${P.gold}, #fff8dc, ${P.gold}, ${P.goldDim});
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: goldShimmer 3s linear infinite;
  }

  .foil-card { animation: foilRotate 4s ease-in-out infinite; }
  .legendary-glow { animation: legendaryPulse 2s ease-in-out infinite; }

  .gold-btn {
    background: linear-gradient(135deg, ${P.goldDim}, ${P.gold}, ${P.goldDim});
    color: ${P.darkBrown};
    border: none;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.08em;
    transition: transform 0.1s, filter 0.2s;
    cursor: pointer;
  }
  .gold-btn:hover { filter: brightness(1.1); }
  .gold-btn:active { transform: scale(0.96); }
  .gold-btn:disabled {
    background: #3a3025;
    color: #6b5c44;
    cursor: not-allowed;
  }

  .ghost-btn {
    background: transparent;
    color: ${P.gold};
    border: 1px solid ${P.goldDim}88;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.08em;
    transition: background 0.2s, transform 0.1s;
    cursor: pointer;
  }
  .ghost-btn:hover { background: ${P.gold}18; }
  .ghost-btn:active { transform: scale(0.96); }

  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: ${P.deepBlack};
  }

  .gold-divider {
    width: 64px;
    height: 2px;
    background: linear-gradient(90deg, transparent, ${P.gold}, transparent);
    margin: 0 auto;
  }

  .card-select {
    background: ${P.brown}aa;
    border: 1px solid ${P.gold}33;
    color: ${P.sand};
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
    cursor: pointer;
  }
  .card-select:hover { border-color: ${P.gold}88; background: ${P.brown}; }
  .card-select.selected { border-color: ${P.gold}; background: ${P.brown}; color: ${P.gold}; }
  .card-select:active { transform: scale(0.97); }

  .kbd-key {
    background: ${P.brown};
    border: 1px solid ${P.gold}33;
    color: ${P.sand};
    transition: background 0.1s, transform 0.08s;
    cursor: pointer;
    border-radius: 6px;
  }
  .kbd-key:active { background: ${P.gold}; color: ${P.darkBrown}; transform: scale(0.9); }
`;

function cls(...args: (string | false | undefined | null)[]) {
  return args.filter(Boolean).join(' ');
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function Screen({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="screen" style={style}>
      {children}
    </div>
  );
}

function GoldButton({
  onClick,
  children,
  disabled,
  ghost,
  size = 'md',
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  ghost?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const padding = size === 'lg' ? '18px 48px' : size === 'sm' ? '10px 24px' : '14px 36px';
  const fontSize = size === 'lg' ? '28px' : size === 'sm' ? '16px' : '22px';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={ghost ? 'ghost-btn' : 'gold-btn'}
      style={{ padding, fontSize, borderRadius: '4px', userSelect: 'none' }}
    >
      {children}
    </button>
  );
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen>
      {/* Background texture */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
        backgroundSize: '12px 12px',
      }} />

      <div style={{ textAlign: 'center', animation: 'fadeUp 0.8s ease both' }}>
        <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '24px' }}>
          SAN DIEGO PADRES
        </p>

        <h1 className="bebas shimmer-text" style={{ fontSize: 'clamp(64px, 10vw, 110px)', lineHeight: 0.9, marginBottom: '16px' }}>
          Sports Card<br />Generator
        </h1>

        <div className="gold-divider" style={{ margin: '24px auto' }} />

        <p style={{ color: P.sand, fontSize: '18px', letterSpacing: '0.05em', marginBottom: '48px', opacity: 0.7 }}>
          Strike a pose. Earn your card.
        </p>

        <GoldButton onClick={onStart} size="lg">TAP TO BEGIN</GoldButton>
      </div>

      <p style={{ position: 'absolute', bottom: '24px', color: P.goldDim, fontSize: '11px', letterSpacing: '0.15em', opacity: 0.5 }}>
        POWERED BY AI
      </p>
    </Screen>
  );
}

// ─── Photo ────────────────────────────────────────────────────────────────────

function PhotoScreen({ onCapture }: { onCapture: (photo: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(console.error);
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    const id = setInterval(() => {
      count--;
      if (count === 0) { clearInterval(id); setCountdown(null); snap(); }
      else setCountdown(count);
    }, 1000);
  };

  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 1 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '52px', color: P.gold, marginBottom: '8px' }}>Take Your Photo</h2>
      <div className="gold-divider" style={{ marginBottom: '32px' }} />

      <div style={{
        width: '320px', height: '240px', borderRadius: '4px', overflow: 'hidden',
        border: `2px solid ${P.gold}66`, position: 'relative',
        boxShadow: `0 0 32px ${P.gold}22`,
        animation: 'pulseGold 3s ease-in-out infinite',
      }}>
        {preview
          ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }
        {countdown !== null && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}>
            <span className="bebas" style={{ fontSize: '120px', color: P.gold }}>{countdown}</span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
        {preview ? (
          <>
            <GoldButton onClick={() => setPreview(null)} ghost>RETAKE</GoldButton>
            <GoldButton onClick={() => onCapture(preview)}>USE THIS</GoldButton>
          </>
        ) : (
          <GoldButton onClick={startCountdown} disabled={!ready || countdown !== null}>
            {countdown !== null ? `${countdown}...` : 'TAKE PHOTO'}
          </GoldButton>
        )}
      </div>
    </Screen>
  );
}

// ─── Name ─────────────────────────────────────────────────────────────────────

function NameScreen({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('');
  const rows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M','<'],
  ];

  const tap = (key: string) => {
    if (key === '<') setName(n => n.slice(0, -1));
    else if (name.length < 20) setName(n => n + key);
  };

  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 2 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '52px', color: P.gold, marginBottom: '8px' }}>What's Your Name?</h2>
      <div className="gold-divider" style={{ marginBottom: '24px' }} />

      <div style={{
        width: '100%', maxWidth: '480px', background: P.brown, border: `1px solid ${P.gold}66`,
        borderRadius: '4px', padding: '16px 24px', fontSize: '36px', textAlign: 'center',
        letterSpacing: '0.1em', minHeight: '64px', marginBottom: '24px', fontFamily: "'Bebas Neue', sans-serif",
        color: name ? P.gold : P.goldDim + '44',
      }}>
        {name || 'TAP TO TYPE'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '480px', marginBottom: '24px' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {row.map(key => (
              <button key={key} onClick={() => tap(key)} className="kbd-key"
                style={{ width: '40px', height: '40px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', userSelect: 'none' }}>
                {key}
              </button>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
          <button onClick={() => tap(' ')} className="kbd-key"
            style={{ width: '180px', height: '40px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.1em', userSelect: 'none' }}>
            SPACE
          </button>
        </div>
      </div>

      <GoldButton onClick={() => onNext(name.trim())} disabled={name.trim().length < 2}>NEXT</GoldButton>
    </Screen>
  );
}

// ─── Sport ────────────────────────────────────────────────────────────────────

function SportScreen({ onNext }: { onNext: (sport: string) => void }) {
  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 3 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '52px', color: P.gold, marginBottom: '8px' }}>Pick Your Sport</h2>
      <div className="gold-divider" style={{ marginBottom: '32px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        {SPORTS.map(sport => (
          <button key={sport} onClick={() => onNext(sport)} className="card-select bebas"
            style={{ padding: '20px', fontSize: '28px', letterSpacing: '0.08em', borderRadius: '4px', border: 'none', userSelect: 'none' }}>
            {sport}
          </button>
        ))}
      </div>
    </Screen>
  );
}

// ─── Action ───────────────────────────────────────────────────────────────────

function ActionScreen({ sport, onNext }: { sport: string; onNext: (mode: string) => void }) {
  const actions = SPORT_ACTIONS[sport] ?? [];
  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 3 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '52px', color: P.gold, marginBottom: '8px' }}>{sport}</h2>
      <div className="gold-divider" style={{ marginBottom: '32px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        {actions.map(action => (
          <button key={action.mode} onClick={() => onNext(action.mode)} className="card-select bebas"
            style={{ padding: '20px', fontSize: '28px', letterSpacing: '0.08em', borderRadius: '4px', border: 'none', userSelect: 'none' }}>
            {action.label}
          </button>
        ))}
      </div>
    </Screen>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function TeamScreen({ onNext }: { onNext: (team: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 4 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '52px', color: P.gold, marginBottom: '8px' }}>Favorite Team</h2>
      <div className="gold-divider" style={{ marginBottom: '24px' }} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
        width: '100%', maxWidth: '560px', overflowY: 'auto', maxHeight: '50vh',
        marginBottom: '24px',
      }}>
        {TEAM_LIST.map(t => (
          <button key={t} onClick={() => setSelected(t)}
            className={cls('card-select bebas', selected === t && 'selected')}
            style={{ padding: '12px 8px', fontSize: '14px', letterSpacing: '0.05em', borderRadius: '4px', border: 'none', userSelect: 'none' }}>
            {t}
          </button>
        ))}
      </div>

      <GoldButton onClick={() => selected && onNext(selected)} disabled={!selected}>NEXT</GoldButton>
    </Screen>
  );
}

// ─── Recording ────────────────────────────────────────────────────────────────

function RecordingScreen({ mode, onDone }: { mode: string; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<'get-ready' | 'countdown' | 'recording' | 'done'>('get-ready');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then(s => {
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(console.error);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, []);

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    let c = 3;
    setCountdown(c);
    const id = setInterval(() => {
      c--;
      if (c === 0) { clearInterval(id); beginRecording(); }
      else setCountdown(c);
    }, 1000);
  }, []);

  const beginRecording = () => {
    setPhase('recording');
    let e = 0;
    const id = setInterval(() => {
      e++;
      setElapsed(e);
      if (e >= RECORD_SECONDS) {
        clearInterval(id);
        setPhase('done');
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setTimeout(onDone, 300);
      }
    }, 1000);
  };

  const progress = Math.min((elapsed / RECORD_SECONDS) * 100, 100);

  const modeLabel =
    mode === 'swing' ? 'Show Your Swing'
    : mode === 'pitch' ? 'Throw Your Pitch'
    : mode.startsWith('soccer') ? 'Show Your Kick'
    : mode.startsWith('football') ? 'Show Your Move'
    : mode.startsWith('basketball') ? 'Show Your Shot'
    : 'Go';

  const readyText =
    mode === 'swing' ? 'Get into your batting stance and get ready to swing.'
    : mode === 'pitch' ? 'Get into your pitching stance and get ready to throw.'
    : mode.startsWith('soccer') ? 'Get into position and get ready to kick.'
    : mode.startsWith('football') ? 'Get into position and get ready.'
    : mode.startsWith('basketball') ? 'Get into position and get ready to shoot.'
    : 'Get ready.';

  return (
    <Screen>
      <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em', marginBottom: '12px' }}>
        STEP 5 OF 5
      </p>
      <h2 className="bebas" style={{ fontSize: '48px', color: P.gold, marginBottom: '8px' }}>{modeLabel}</h2>
      <div className="gold-divider" style={{ marginBottom: '24px' }} />

      <div style={{
        width: '320px', height: '240px', borderRadius: '4px', overflow: 'hidden',
        border: `2px solid ${phase === 'recording' ? P.gold : P.gold + '44'}`,
        position: 'relative',
        boxShadow: phase === 'recording' ? `0 0 32px ${P.gold}44` : 'none',
        transition: 'box-shadow 0.3s, border-color 0.3s',
        marginBottom: '20px',
      }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />

        {phase === 'countdown' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}>
            <span className="bebas" style={{ fontSize: '120px', color: P.gold }}>{countdown}</span>
          </div>
        )}

        {phase === 'recording' && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#c00', borderRadius: '2px', padding: '4px 10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'dotBounce 1s ease-in-out infinite' }} />
            <span className="bebas" style={{ fontSize: '14px', letterSpacing: '0.1em' }}>REC</span>
          </div>
        )}
      </div>

      {phase === 'recording' && (
        <div style={{ width: '320px', height: '3px', background: P.brown, borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '100%', background: P.gold, width: `${progress}%`, transition: 'width 1s linear' }} />
        </div>
      )}

      {phase === 'get-ready' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: P.sand, fontSize: '16px', marginBottom: '24px', opacity: 0.7, letterSpacing: '0.03em' }}>{readyText}</p>
          <GoldButton onClick={startCountdown}>I'M READY</GoldButton>
        </div>
      )}
      {phase === 'countdown' && <p className="bebas" style={{ color: P.sand, fontSize: '24px', letterSpacing: '0.1em' }}>GET READY...</p>}
      {phase === 'recording' && <p className="bebas" style={{ color: P.gold, fontSize: '22px', letterSpacing: '0.08em', animation: 'dotBounce 1.5s ease-in-out infinite' }}>HOLD YOUR POSE</p>}
      {phase === 'done' && <p className="bebas" style={{ color: P.gold, fontSize: '22px', letterSpacing: '0.1em' }}>ANALYZING...</p>}
    </Screen>
  );
}

// ─── Generating ───────────────────────────────────────────────────────────────

function GeneratingScreen({ playerName, rarity }: { playerName: string; rarity: Rarity }) {
  const messages = [
    'Analyzing your pose...',
    'Running the numbers...',
    'Consulting the scouts...',
    'Designing your card...',
    'Determining rarity...',
    'Almost there...',
  ];
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 1800);
    return () => clearInterval(id);
  }, []);

  const rarityColor = rarity === 'legendary' ? P.gold : rarity === 'epic' ? '#c084fc' : rarity === 'rare' ? '#60a5fa' : P.sand;
  const rarityLabel = rarity.toUpperCase();

  return (
    <Screen style={{ background: `radial-gradient(ellipse at center, ${P.brown}88 0%, ${P.deepBlack} 70%)` }}>
      <div style={{ textAlign: 'center' }}>
        {/* Animated gold diamond */}
        <div style={{ marginBottom: '32px', position: 'relative', display: 'inline-block' }}>
          <div style={{
            width: '80px', height: '80px', background: `linear-gradient(135deg, ${P.goldDim}, ${P.gold})`,
            transform: 'rotate(45deg)', margin: '0 auto',
            boxShadow: `0 0 40px ${P.gold}66`,
            animation: 'legendaryPulse 2s ease-in-out infinite',
          }} />
        </div>

        <h2 className="bebas shimmer-text" style={{ fontSize: '52px', marginBottom: '8px' }}>
          Generating Your Card
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: '40px', height: '1px', background: rarityColor + '66' }} />
          <span className="bebas" style={{ color: rarityColor, fontSize: '16px', letterSpacing: '0.2em' }}>{rarityLabel}</span>
          <div style={{ width: '40px', height: '1px', background: rarityColor + '66' }} />
        </div>

        <p style={{ color: P.sand, fontSize: '16px', opacity: 0.6, marginBottom: '32px', letterSpacing: '0.03em' }}>
          {messages[msgIdx]}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%', background: P.gold,
              animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>

        <p style={{ marginTop: '32px', color: P.goldDim, fontSize: '13px', letterSpacing: '0.1em', opacity: 0.5 }}>
          HOLD TIGHT, {playerName.toUpperCase()}
        </p>
      </div>
    </Screen>
  );
}

// ─── Reveal ───────────────────────────────────────────────────────────────────

function RevealScreen({ card, photo, team, playerName, rarity, onPlayAgain }: {
  card: CardData; photo: string | null; team: string;
  playerName: string; rarity: Rarity; onPlayAgain: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const colors = teams[team] ?? teams['Dodgers'];

  useEffect(() => { setTimeout(() => setVisible(true), 120); }, []);

  const rarityBorder =
    rarity === 'legendary' ? `0 0 48px ${P.gold}cc, 0 0 96px ${P.gold}44`
    : rarity === 'epic' ? '0 0 32px #c084fc88'
    : rarity === 'rare' ? '0 0 24px #60a5fa66'
    : 'none';

  const rarityLabel = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }[rarity];

  return (
    <Screen style={{ background: `radial-gradient(ellipse at center, ${P.brown}66 0%, ${P.deepBlack} 65%)` }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.94)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p className="bebas" style={{ color: P.goldDim, fontSize: '13px', letterSpacing: '0.25em' }}>
          YOUR CARD IS READY
        </p>
        <h2 className="bebas shimmer-text" style={{ fontSize: '48px' }}>
          {playerName.toUpperCase()}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '1px', background: P.gold + '66' }} />
          <span className="bebas" style={{
            color: rarity === 'legendary' ? P.gold : rarity === 'epic' ? '#c084fc' : rarity === 'rare' ? '#60a5fa' : P.sand,
            fontSize: '14px', letterSpacing: '0.2em',
          }}>{rarityLabel.toUpperCase()} CARD</span>
          <div style={{ width: '32px', height: '1px', background: P.gold + '66' }} />
        </div>

        <div
          className={rarity === 'legendary' ? 'legendary-glow' : rarity === 'epic' ? 'foil-card' : ''}
          style={{ boxShadow: rarityBorder, borderRadius: '12px' }}
        >
          <BaseballCard
            playerImage={photo}
            playerName={card.nickname}
            team={team}
            colors={colors}
            position={card.position}
            number={String(Math.floor(Math.random() * 98) + 1).padStart(2, '0')}
            stats={card.stats}
          />
        </div>

        <p style={{ color: P.sand, fontSize: '14px', maxWidth: '280px', textAlign: 'center', opacity: 0.65, lineHeight: 1.5 }}>
          {card.funFact}
        </p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <GoldButton onClick={onPlayAgain} ghost>PLAY AGAIN</GoldButton>
          <GoldButton onClick={() => window.print()}>PRINT CARD</GoldButton>
        </div>
      </div>
    </Screen>
  );
}

// ─── Main Flow ────────────────────────────────────────────────────────────────

export default function KioskFlow() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [photo, setPhoto] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('');
  const [sport, setSport] = useState('');
  const [mode, setMode] = useState<string>('pitch');
  const [card, setCard] = useState<CardData | null>(null);
  const [rarity] = useState<Rarity>(() => rollRarity());

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLOBAL_STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (screen !== 'generating') return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.recordingStatus === 'done' && data.card) {
          setCard(data.card.stats);
          if (data.card.player?.photo) setPhoto(data.card.player.photo);
          setScreen('reveal');
        } else if (data.recordingStatus === 'error' && data.card) {
          setCard(data.card.stats);
          setScreen('reveal');
        }
      } catch (e) { console.error('Poll error:', e); }
    }, 1500);
    return () => clearInterval(id);
  }, [screen]);

  const handleRecordingDone = async () => {
    try {
      await fetch('/api/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, name: playerName, team, sport, photo }),
      });
    } catch (e) { console.error('Failed to start recording:', e); }
    setScreen('generating');
  };

  const handlePlayAgain = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setPhoto(null); setPlayerName(''); setTeam(''); setSport(''); setCard(null); setMode('pitch');
    setScreen('welcome');
  };

  return (
    <>
      {screen === 'welcome'    && <WelcomeScreen onStart={() => setScreen('photo')} />}
      {screen === 'photo'      && <PhotoScreen onCapture={p => { setPhoto(p); setScreen('name'); }} />}
      {screen === 'name'       && <NameScreen onNext={n => { setPlayerName(n); setScreen('sport'); }} />}
      {screen === 'sport'      && <SportScreen onNext={s => { setSport(s); setScreen('action'); }} />}
      {screen === 'action'     && <ActionScreen sport={sport} onNext={m => { setMode(m); setScreen('team'); }} />}
      {screen === 'team'       && <TeamScreen onNext={t => { setTeam(t); setScreen('recording'); }} />}
      {screen === 'recording'  && <RecordingScreen mode={mode} onDone={handleRecordingDone} />}
      {screen === 'generating' && <GeneratingScreen playerName={playerName} rarity={rarity} />}
      {screen === 'reveal'     && card && (
        <RevealScreen card={card} photo={photo} team={team} playerName={playerName} rarity={rarity} onPlayAgain={handlePlayAgain} />
      )}
    </>
  );
}