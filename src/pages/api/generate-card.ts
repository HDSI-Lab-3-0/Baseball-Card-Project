import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const prerender = false;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FRONT_TEMPLATE_PATH = fileURLToPath(new URL('../../../public/template/front.png', import.meta.url));
const BACK_TEMPLATE_PATH = fileURLToPath(new URL('../../../public/template/stats.png', import.meta.url));

const templateCache: Record<'front' | 'back', string | null> = {
  front: null,
  back: null,
};

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

const loadTemplate = async (type: 'front' | 'back') => {
  if (templateCache[type]) return templateCache[type];

  const filePath = type === 'front' ? FRONT_TEMPLATE_PATH : BACK_TEMPLATE_PATH;
  const buffer = await readFile(filePath);
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  templateCache[type] = dataUrl;
  return dataUrl;
};

const ensureDataUrl = (image: string) =>
  image.startsWith('data:') ? image : `data:image/png;base64,${image}`;

const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomStats = () => {
  const avg = (0.24 + Math.random() * 0.12).toFixed(3).replace(/^0/, '.');
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
    funFact: ['Carries sunflower seeds in a gold pouch.', 'Once stole home for fun.', 'Can juggle three bats mid-dugout.'][randomInRange(0, 2)],
  } as const;
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
    }
  }

  return null;
};

const callGemini = async (payload: Record<string, unknown>) => {
  if (!import.meta.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

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
    throw new Error('Model response did not contain an image');
  }

  return image;
};

const buildFrontPayload = async ({
  playerImage,
  playerName,
  team,
}: {
  playerImage: string;
  playerName: string;
  team: string;
}) => {
  const templateFront = await loadTemplate('front');
  const jerseyNumber = randomInRange(1, 98);

  return {
    model: 'google/gemini-2.5-flash-image',
    modalities: ['image', 'text'],
    messages: [
      {
        role: 'system',
        content:
          'You are a premium baseball card designer. Preserve every decorative element from the template image while swapping in the provided player photo and overlaying the requested text in matching fonts and placements.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Use this template as the base design. Replace the portrait with the supplied player photo and update the name banner to "${playerName}" with the same typography. Set the team stripe to "${team}" and show jersey number #${jerseyNumber}. Do not change colors, borders, or layout. Return only the finished card front as a high-resolution image.`,
          },
          { type: 'image_url', image_url: { url: templateFront } },
          { type: 'image_url', image_url: { url: ensureDataUrl(playerImage) } },
        ],
      },
    ],
    image_config: { aspect_ratio: '3:4' },
  };
};

const buildBackPayload = async ({
  stats,
  playerName,
}: {
  stats: ReturnType<typeof generateRandomStats>['stats'];
  playerName: string;
}) => {
  const templateBack = await loadTemplate('back');
  const statLines = Object.entries(stats)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  return {
    model: 'google/gemini-2.5-flash-image',
    modalities: ['image', 'text'],
    messages: [
      {
        role: 'system',
        content:
          'You edit baseball card backs. Replace only the name, stat numbers, the season highlights paragraph, and descriptive blurb while preserving the template colors, layout, logos, and texture. Make sure it is very accurate',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Update every location that shows the player name to "${playerName}" (including the header plaque and stat table). Overlay these updated stat values into the matching rows while keeping kerning, column alignment, and font weights identical. Do not introduce any new stat categories—only replace the numbers that already exist in the template. Rewrite the "Season Highlights" paragraph with a fresh, custom description that references the player's unstoppable vibes while staying on-brand with the design. Maintain all other typography from the template.\n\n${statLines}\n\nAdd a short quip in the note section about the player having unstoppable vibes. Return only the finished card back image.`,
          },
          { type: 'image_url', image_url: { url: templateBack } },
        ],
      },
    ],
    image_config: { aspect_ratio: '3:4' },
    effort: 'high',
  };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { imageBase64, team, playerName } = await request.json();

    if (!imageBase64 || !team || !playerName) {
      return new Response(JSON.stringify({ error: 'Missing photo, team, or name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const statsTemplate = generateRandomStats();

    const [frontCard, backCard] = await Promise.all([
      callGemini(await buildFrontPayload({
        playerImage: imageBase64,
        playerName,
        team,
      })),
      callGemini(await buildBackPayload({ stats: statsTemplate.stats, playerName })),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        frontCard,
        backCard,
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
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        modalities: ['text'],
        messages: [{ role: 'user', content: 'Reply with: API ready.' }],
      }),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: data?.choices?.[0]?.message?.content ?? 'API ready.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};