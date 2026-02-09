import type { APIRoute } from 'astro';

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

const extractImageUrl = (completion: any): string | null => {
  const message = completion?.choices?.[0]?.message;
  if (!message) return null;

  // Check for images array
  if (Array.isArray(message.images) && message.images.length > 0) {
    return message.images[0]?.image_url?.url ?? null;
  }

  // Check content array for various image formats
  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      // Check for native output_image type
      if (part?.type === 'output_image' && part?.image_url?.url) {
        return part.image_url.url;
      }
      // Check for inline data URLs in standard image_url type
      if (part?.type === 'image_url' && part?.image_url?.url?.startsWith('data:')) {
        return part.image_url.url;
      }
      // Gemini format
      if (part?.type === 'image' && part?.source?.data) {
        const mediaType = part.source.media_type || 'image/png';
        return `data:${mediaType};base64,${part.source.data}`;
      }
    }
  }

  // Fallback: Check if the text content itself is a URL (rare but possible)
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
      message: 'Baseball Card API ready. POST with { imageBase64, playerName, team }',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};