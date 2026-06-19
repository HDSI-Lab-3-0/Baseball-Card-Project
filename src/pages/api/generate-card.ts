import type { APIRoute } from 'astro';
import { setLatestCard, getPlayer } from '../../lib/cardStore';

export const prerender = false;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const baseHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.OPENROUTER_API_KEY ?? ''}`,
  };

  if (import.meta.env.OPENROUTER_SITE_URL) {
    headers['HTTP-Referer'] = import.meta.env.OPENROUTER_SITE_URL;
  }

  if (import.meta.env.OPENROUTER_APP_NAME) {
    headers['X-Title'] = import.meta.env.OPENROUTER_APP_NAME;
  }

  return headers;
};

const randomInRange = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomStats = () => {
  const avg = (0.24 + Math.random() * 0.12).toFixed(3).replace(/^0/, '');
  const ops = (0.68 + Math.random() * 0.3).toFixed(3);

  return {
    nickname: ['The Heater', 'Moonshot', 'Snack King', 'Laser Arm', 'Midnight Train'][randomInRange(0, 4)],
    position: ['Designated Vibes', 'Utility Firecracker', 'Ace of Snacks', 'Hype Captain'][randomInRange(0, 3)],
    stats: {
      AVG: avg,
      HR: randomInRange(8, 52).toString(),
      RBI: randomInRange(20, 130).toString(),
      SB: randomInRange(2, 60).toString(),
      OPS: ops,
      WAR: (Math.random() * 8).toFixed(1),
    },
    funFact: [
      'Carries sunflower seeds in a gold pouch.',
      'Once stole home for fun.',
      'Can juggle three bats mid-dugout.',
    ][randomInRange(0, 2)],
  } as const;
};

// Convert Pi pose stats { POWER: 87, FORM: 78, ... } into baseball card stats
const poseStatsToCardStats = (
  mode: string,
  poseStats: Record<string, number>,
  features: Record<string, number>
): { nickname: string; position: string; stats: Record<string, string>; funFact: string } => {
  const fmt = (n: number) => String(Math.round(n));

  if (mode === 'swing') {
    const avg = (0.2 + ((poseStats.FORM - 75) / 24) * 0.15).toFixed(3).replace(/^0/, '');
    const ops = (0.65 + ((poseStats.BAT_SPEED - 75) / 24) * 0.35).toFixed(3);
    return {
      nickname: ['Lumber Lord', 'Sweet Swinger', 'The Whip', 'Bat Wizard', 'Iron Wrists'][randomInRange(0, 4)],
      position: ['Designated Hitter', 'Power Hitter', 'Cleanup Batter', 'Switch Hitter'][randomInRange(0, 3)],
      stats: {
        AVG: avg,
        HR: fmt(8 + ((poseStats.POWER - 75) / 24) * 44),
        RBI: fmt(20 + ((poseStats.POWER - 75) / 24) * 110),
        SB: fmt(2 + ((poseStats.STYLE - 75) / 24) * 40),
        OPS: ops,
        WAR: (((poseStats.FORM - 75) / 24) * 8).toFixed(1),
      },
      funFact: [
        `Peak wrist speed rated ${poseStats.BAT_SPEED}/99 by scouts.`,
        `Hip rotation so fast it bends spacetime.`,
        `Bat speed clocked at elite tier in the lab.`,
      ][randomInRange(0, 2)],
    };
  } else {
    // pitch
    const era = Math.max(1.5, 6.5 - ((poseStats.POWER - 75) / 24) * 5).toFixed(2);
    const whip = Math.max(0.8, 2.0 - ((poseStats.FORM - 75) / 24) * 1.2).toFixed(2);
    return {
      nickname: ['The Closer', 'Heat Seeker', 'Mound Menace', 'Strikeout King', 'The Filth'][randomInRange(0, 4)],
      position: ['Starting Pitcher', 'Ace', 'Closer', 'Power Arm'][randomInRange(0, 3)],
      stats: {
        ERA: era,
        K: fmt(80 + ((poseStats.POWER - 75) / 24) * 220),
        WHIP: whip,
        IP: fmt(100 + ((poseStats.HUSTLE - 75) / 24) * 162),
        WIN: fmt(5 + ((poseStats.INTIMIDATION - 75) / 24) * 20),
        WAR: (((poseStats.POWER - 75) / 24) * 9).toFixed(1),
      },
      funFact: [
        `Leg kick measured at ${(features.peak_leg_kick * 100).toFixed(0)}cm of pure terror.`,
        `Arm extension in the 99th percentile according to the Pi.`,
        `Intimidation factor: ${poseStats.INTIMIDATION}/99.`,
      ][randomInRange(0, 2)],
    };
  }
};

const extractImageUrl = (completion: any): string | null => {
  const message = completion?.choices?.[0]?.message;
  if (!message) return null;

  if (Array.isArray(message.images) && message.images.length > 0) {
    return message.images[0]?.image_url?.url ?? null;
  }

  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'output_image' && part?.image_url?.url) {
        return part.image_url.url;
      }
      if (part?.type === 'image_url' && part?.image_url?.url?.startsWith('data:')) {
        return part.image_url.url;
      }
      if (part?.type === 'image' && part?.source?.data) {
        const mediaType = part.source.media_type || 'image/png';
        return `data:${mediaType};base64,${part.source.data}`;
      }
    }
  }

  if (typeof content === 'string' && content.startsWith('http')) {
    return content;
  }

  return null;
};

const stylizePlayerPhoto = async (
  imageBase64: string,
  playerName: string,
  team: string
): Promise<string> => {
  if (!import.meta.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  let mediaType = 'image/jpeg';
  const match = imageBase64.match(/^data:(image\/\w+);base64,/);
  if (match) {
    mediaType = match[1];
  }

  const payload = {
    model: 'google/gemini-2.5-flash-image',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${base64Data}`,
            },
          },
          {
            type: 'text',
            text: `Transform this photo into a stylized vintage 1980s-90s baseball card portrait for player "${playerName}" of the ${team}.

Requirements:
- Keep the person's face and features clearly recognizable - this is the most important
- Apply a classic baseball card aesthetic: warm color tones, slight soft focus, professional sports portrait lighting
- Style similar to Topps or Upper Deck cards from the late 80s/early 90s
- Portrait orientation, head and shoulders framing preferred
- Clean, slightly blurred or gradient background typical of baseball cards
- Add subtle vintage film grain or texture
- Make sure its cartoony 

Generate the stylized portrait image now.`,
          },
        ],
      },
    ],
    modalities: ['text', 'image'],
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const image = extractImageUrl(result);

  if (!image) {
    console.warn('Model did not return a stylized image, using original');
    return imageBase64;
  }

  return image;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // ── Pi pose path ──────────────────────────────────────────────────────────
    // Triggered when the Raspberry Pi posts { mode, stats, features }
    if (body.mode && body.stats && body.features) {
      const mode = body.mode as string;
      const poseStats = body.stats as Record<string, number>;
      const features = body.features as Record<string, number>;

      const cardStats = poseStatsToCardStats(mode, poseStats, features);

      // Stylize the player photo if one was captured during the kiosk flow
      const player = getPlayer();
      let stylizedImage: string | null = null;
      if (player?.photo) {
        try {
          stylizedImage = await stylizePlayerPhoto(player.photo, player.name, player.team);
        } catch (err) {
          console.warn('Image stylization failed, using original:', err);
          stylizedImage = player.photo;
        }
      }

      setLatestCard({
        mode,
        stats: cardStats,
        poseStats,
        receivedAt: Date.now(),
        
        player: player 
        ? { ...player, photo: stylizedImage ?? player.photo }
        : { name: 'Player', team: 'Dodgers', sport: 'baseball', photo: stylizedImage },
      });

      return new Response(
        JSON.stringify({ success: true, stats: cardStats, poseStats, mode, stylizedImage }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Web UI path ───────────────────────────────────────────────────────────
    // Triggered when the browser posts { imageBase64, playerName, team }
    const team = typeof body.team === 'string' ? body.team.trim() : '';
    const playerName = typeof body.playerName === 'string' ? body.playerName.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';

    if (!team || !playerName) {
      return new Response(JSON.stringify({ error: 'Missing team or name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Missing player image' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (playerName.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Player name too long (max 50 characters)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (team.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Team name too long (max 30 characters)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statsTemplate = generateRandomStats();
    const stylizedImage = await stylizePlayerPhoto(imageBase64, playerName, team);

    return new Response(
      JSON.stringify({
        success: true,
        stylizedImage,
        stats: statsTemplate,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate card',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Baseball Card API ready. POST with { imageBase64, playerName, team } or { mode, stats, features }',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};