// Compare a card's stats with the real hitters on the chosen MLB team.
// The hitters come from /api/mlb-compare (MLB's public stats API).

// Card team name -> MLB Stats API team id
export const MLB_TEAM_IDS: Record<string, number> = {
  Dodgers: 119,
  Yankees: 147,
  'Red Sox': 111,
  Cubs: 112,
  Giants: 137,
  Cardinals: 138,
  Mets: 121,
  Braves: 144,
  Astros: 117,
  Phillies: 143,
  Padres: 135,
  Mariners: 136,
  Angels: 108,
  'White Sox': 145,
  Rays: 139,
  'Blue Jays': 141,
  Twins: 142,
  Tigers: 116,
  Guardians: 114,
  Royals: 118,
  Athletics: 133,
  Rangers: 140,
  Orioles: 110,
  Nationals: 120,
  Marlins: 146,
  Brewers: 158,
  Reds: 113,
  Pirates: 134,
  Rockies: 115,
  Diamondbacks: 109,
};

export type MlbHitter = {
  name: string;
  lastName: string;
  position: string;
  pa: number;
  AVG: number;
  HR: number;
  RBI: number;
  SB: number;
  OPS: number;
};

export type MlbTeamStats = {
  team: string;
  season: number;
  hitters: MlbHitter[];
};

// The card stats MLB also tracks (WAR isn't in the stats API).
// `spread` is roughly one "big step" in that stat, so each stat counts about equally
// when looking for the most similar player.
const STATS = [
  { key: 'AVG', spread: 0.03, rate: true },
  { key: 'HR', spread: 10, rate: false },
  { key: 'RBI', spread: 25, rate: false },
  { key: 'SB', spread: 10, rate: false },
  { key: 'OPS', spread: 0.1, rate: true },
] as const;

type StatKey = (typeof STATS)[number]['key'];

export type ComparisonRow = {
  key: StatKey;
  you: string;
  comp: string;
  leader: string;
  leaderName: string;
  rank: number; // where the card's number would rank on the team (1 = best)
  of: number; // hitters ranked, including the card
};

export type Comparison = {
  comp: MlbHitter;
  rows: ComparisonRow[];
};

// .342 for rates, 24 for counts
const show = (value: number, rate: boolean) =>
  rate ? value.toFixed(3).replace(/^0/, '') : String(Math.round(value));

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function compareToTeam(cardStats: Record<string, string>, hitters: MlbHitter[]): Comparison | null {
  const mine = STATS.map((s) => ({ ...s, value: parseFloat(cardStats[s.key]) })).filter((s) =>
    Number.isFinite(s.value),
  );
  if (!mine.length || !hitters.length) return null;

  // Most similar hitter: smallest distance across the shared stats
  const distance = (h: MlbHitter) =>
    mine.reduce((sum, s) => sum + ((s.value - h[s.key]) / s.spread) ** 2, 0);
  const comp = hitters.reduce((best, h) => (distance(h) < distance(best) ? h : best));

  const rows = mine.map((s) => {
    const leader = hitters.reduce((best, h) => (h[s.key] > best[s.key] ? h : best));
    return {
      key: s.key,
      you: show(s.value, s.rate),
      comp: show(comp[s.key], s.rate),
      leader: show(leader[s.key], s.rate),
      leaderName: leader.lastName,
      rank: 1 + hitters.filter((h) => h[s.key] > s.value).length,
      of: hitters.length + 1,
    };
  });

  return { comp, rows };
}
