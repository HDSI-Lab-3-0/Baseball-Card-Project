// src/components/PiCardDisplay.tsx
import { useState, useEffect, useRef } from 'react';
import { teams } from '../data/teams';
import BaseballCard from './BaseballCard';

interface PiCard {
  mode: string;
  stats: {
    nickname: string;
    position: string;
    stats: Record<string, string>;
    funFact: string;
  };
  poseStats: Record<string, number>;
  receivedAt: number;
}

const POLL_INTERVAL = 1500; // ms

export default function PiCardDisplay() {
  const [card, setCard] = useState<PiCard | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [status, setStatus] = useState<'waiting' | 'live'>('waiting');
  const lastReceivedAt = useRef<number | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/latest-card');
        const data = await res.json();

        if (data.ready && data.receivedAt !== lastReceivedAt.current) {
          lastReceivedAt.current = data.receivedAt;
          setCard(data);
          setStatus('live');

          // Flash "new" indicator briefly
          setIsNew(true);
          setTimeout(() => setIsNew(false), 2000);
        }
      } catch {
        // silently ignore network blips
      }
    };

    poll(); // immediate first check
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Pick a team color based on mode, or default to Dodgers
  const teamName = card?.mode === 'swing' ? 'Yankees' : 'Dodgers';
  const colors = teams[teamName];

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-yellow-500 animate-pulse'
          }`}
        />
        <span className="text-sm font-medium text-gray-300">
          {status === 'waiting'
            ? 'Waiting for Pi — press SPACE or P to record a clip...'
            : `Live — last ${card?.mode} received`}
        </span>
      </div>

      {card ? (
        <div
          className={`transition-all duration-500 ${
            isNew ? 'scale-105 drop-shadow-[0_0_24px_rgba(99,202,255,0.6)]' : 'scale-100'
          }`}
        >
          <BaseballCard
            playerImage={null}
            playerName={card.stats.nickname}
            team={teamName}
            colors={colors}
            position={card.stats.position}
            number={String(
              Object.values(card.poseStats).reduce((a, b) => a + b, 0) % 99 || 7
            ).padStart(2, '0')}
            stats={card.stats.stats}
          />

          {/* Fun fact */}
          <div className="mt-4 max-w-xs p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-200 text-sm text-center">
            <strong>Fun Fact:</strong> {card.stats.funFact}
          </div>

          {/* Raw pose stats */}
          <div className="mt-3 max-w-xs p-3 bg-gray-900/60 border border-gray-700 rounded-lg text-xs text-gray-400 font-mono">
            <div className="text-gray-300 font-semibold mb-1 uppercase tracking-wide">
              Pi Pose Scores
            </div>
            {Object.entries(card.poseStats).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Placeholder card while waiting */
        <div className="opacity-30">
          <BaseballCard
            playerImage={null}
            playerName="Awaiting Player"
            team="Dodgers"
            colors={colors}
            position="Press SPACE or P on Pi"
            number="00"
            stats={{ '---': '---', '': '' }}
          />
        </div>
      )}
    </div>
  );
}