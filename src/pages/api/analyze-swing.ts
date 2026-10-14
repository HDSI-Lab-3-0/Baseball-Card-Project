import type { APIRoute } from 'astro';

export const prerender = false;

// Where swing_vision.py is running (python vision/swing_vision.py serve).
// Override in .env with VISION_URL=http://host:port if it runs elsewhere.
const VISION_URL = (import.meta.env.VISION_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Forwards the recorded swing frames to the MoveNet tracker and returns its analysis.
// Going through the site's own server means the kiosk works even when the page is
// opened from another device, and the browser never needs to reach the tracker directly.
export const POST: APIRoute = async ({ request }) => {
  let body: { frames?: unknown; timestamps?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    return json({ error: 'No video frames were sent' }, 400);
  }
  if (body.frames.length > 300) {
    return json({ error: 'Too many frames (max 300)' }, 400);
  }

  try {
    const response = await fetch(`${VISION_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames: body.frames, timestamps: body.timestamps }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json();
    return json(result, response.ok ? 200 : 502);
  } catch (error) {
    console.error('Swing tracker unreachable:', error);
    return json(
      {
        error: 'tracker_offline',
        details: `Couldn't reach the swing tracker at ${VISION_URL}. Start it with: python vision/swing_vision.py serve`,
      },
      503,
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(`${VISION_URL}/health`, { signal: AbortSignal.timeout(3_000) });
    return json({ tracker: response.ok ? 'online' : 'error', ...(await response.json()) });
  } catch {
    return json({ tracker: 'offline', url: VISION_URL }, 503);
  }
};