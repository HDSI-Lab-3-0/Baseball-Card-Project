import type { APIRoute } from 'astro';
import { MLB_TEAM_IDS, type MlbHitter, type MlbTeamStats } from '../../lib/mlbCompare';

export const prerender = false;

// Real season hitting stats for one team, from MLB's public stats API (no key needed).
// GET /api/mlb-compare?team=Dodgers

const MIN_PLATE_APPEARANCES = 100; // regulars only, so counting stats are comparable
const MIN_REGULARS = 8; // fewer than this means the season has barely started
const CACHE_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; data: MlbTeamStats }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function fetchHitters(teamId: number, season: number): Promise<MlbHitter[]> {
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&sportId=1` +
    `&playerPool=all&limit=200&teamId=${teamId}&season=${season}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`MLB stats API returned ${response.status}`);
  const data = await response.json();
  const splits: any[] = data?.stats?.[0]?.splits ?? [];

  return splits
    .map((split) => ({
      name: String(split.player?.fullName ?? ''),
      lastName: String(split.player?.lastName ?? split.player?.fullName ?? ''),
      position: String(split.position?.abbreviation ?? ''),
      pa: Number(split.stat?.plateAppearances ?? 0),
      AVG: parseFloat(split.stat?.avg),
      HR: Number(split.stat?.homeRuns ?? 0),
      RBI: Number(split.stat?.rbi ?? 0),
      SB: Number(split.stat?.stolenBases ?? 0),
      OPS: parseFloat(split.stat?.ops),
    }))
    .filter((h) => h.name && Number.isFinite(h.AVG) && Number.isFinite(h.OPS));
}

export const GET: APIRoute = async ({ url }) => {
  const team = url.searchParams.get('team') ?? '';
  const teamId = MLB_TEAM_IDS[team];
  if (!teamId) return json({ error: `Unknown team: ${team}` }, 400);

  const cached = cache.get(team);
  if (cached && Date.now() - cached.at < CACHE_MS) return json(cached.data);

  try {
    // Use this season; early in the year (or in the offseason before any games)
    // fall back to last season so there are full-season numbers to compare with.
    const thisYear = new Date().getFullYear();
    for (const season of [thisYear, thisYear - 1]) {
      const regulars = (await fetchHitters(teamId, season)).filter((h) => h.pa >= MIN_PLATE_APPEARANCES);
      if (regulars.length >= MIN_REGULARS) {
        const data: MlbTeamStats = { team, season, hitters: regulars };
        cache.set(team, { at: Date.now(), data });
        return json(data);
      }
    }
    return json({ error: 'No season stats available yet' }, 404);
  } catch (error) {
    console.error('MLB stats lookup failed:', error);
    return json({ error: 'mlb_offline' }, 502);
  }
};
