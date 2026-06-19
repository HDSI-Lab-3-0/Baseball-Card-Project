// src/lib/cardStore.ts
// Uses globalThis to survive Astro dev-mode hot reloads and module isolation.

export interface PlayerInfo {
  name: string;
  team: string;
  sport: string;
  photo: string | null;
}

export interface PiCardData {
  mode: string;
  stats: {
    nickname: string;
    position: string;
    stats: Record<string, string>;
    funFact: string;
  };
  poseStats: Record<string, number>;
  receivedAt: number;
  player: PlayerInfo;
}

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

interface Store {
  player: PlayerInfo | null;
  card: PiCardData | null;
  recordingStatus: RecordingStatus;
  recordingMode: string | null;
  error: string | null;
}

// Attach to globalThis so all API routes share the same instance
const g = globalThis as any;
if (!g.__cardStore) {
  g.__cardStore = {
    player: null,
    card: null,
    recordingStatus: 'idle',
    recordingMode: null,
    error: null,
  } as Store;
}

const store: Store = g.__cardStore;

export function setPlayer(info: PlayerInfo) {
  store.player = info;
}

export function getPlayer(): PlayerInfo | null {
  return store.player;
}

export function setLatestCard(data: PiCardData) {
  store.card = data;
  store.recordingStatus = 'done';
}

export function getLatestCard(): PiCardData | null {
  return store.card;
}

export function setRecordingStatus(status: RecordingStatus, mode?: string, error?: string) {
  store.recordingStatus = status;
  if (mode) store.recordingMode = mode;
  if (error) store.error = error;
}

export function getStatus(): Store {
  return { ...store };
}

export function resetStore() {
  store.player = null;
  store.card = null;
  store.recordingStatus = 'idle';
  store.recordingMode = null;
  store.error = null;
}