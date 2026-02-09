import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const prerender = false;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FRONT_TEMPLATE_PATH = fileURLToPath(new URL('../../../public/template/front.png', import.meta.url));
const BACK_TEMPLATE_PATH = fileURLToPath(new URL('../../../public/template/stats.png', import.meta.url));

// Validated Cheap/Best Model for Image Editing (Feb 2026)
// Supports: Image+Text Input -> Image Output
const IMG_MODEL = 'google/gemini-2.5-flash-image'; 

// Cheap Text Model for Health Checks
const TEXT_MODEL = 'google/gemini-2.5-flash-image';

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

  // Handle standard OpenAI-style image response
  if (Array.isArray(message.images) && message.images.length > 0) {
    return message.images[0]?.image_url?.url ?? null;
  }

  // Handle Gemini/OpenRouter specific content arrays
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
    }
  }

  // Fallback: Check if the text content itself is a URL (rare but possible)
  if (typeof content === 'string' && content.startsWith('http')) {
      return content;
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
    throw new Error('Model response did not contain an image. API output: ' + JSON.stringify(result));
  }

  return image;
};

const buildFrontPayload = async ({
  playerImage,
  playerName,
  team,
  promptOverride,
}: {
  playerImage: string;
  playerName: string;
  team: string;
  promptOverride?: string;
}) => {
  const templateFront = await loadTemplate('front');
  const jerseyNumber = randomInRange(1, 98);
  const promptText =
    promptOverride?.trim() ||
    `Use this template as the base design. Replace the portrait with the supplied player photo and update the name banner to "${playerName}" with the same typography. Set the team stripe to "${team}" and show jersey number #${jerseyNumber}. Do not change colors, borders, or layout. Return only the finished card front as a high-resolution image.`;

  return {
    model: IMG_MODEL,
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
            text: promptText,
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
  promptOverride,
}: {
  stats: ReturnType<typeof generateRandomStats>['stats'];
  playerName: string;
  promptOverride?: string;
}) => {
  const templateBack = await loadTemplate('back');
  const statLines = Object.entries(stats)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
  const promptText =
    promptOverride?.trim() ||
    `Update every location that shows the player name to "${playerName}" (including the header plaque and stat table). Overlay these updated stat values into the matching rows while keeping kerning, column alignment, and font weights identical. Do not introduce any new stat categories—only replace the numbers that already exist in the template. Rewrite the "Season Highlights" paragraph with a fresh, custom description that references the player's unstoppable vibes while staying on-brand with the design. Maintain all other typography from the template.\n\n${statLines}\n\nAdd a short quip in the note section about the player having unstoppable vibes. Return only the finished card back image.`;

  return {
    model: IMG_MODEL,
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
            text: promptText,
          },
          { type: 'image_url', image_url: { url: templateBack } },
        ],
      },
    ],
    image_config: { aspect_ratio: '3:4' },
    effort: 'xhigh',
  };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const side = (body?.side ?? 'front').toLowerCase();
    const playerName = body?.playerName?.trim();

    if (!playerName) {
      return new Response(JSON.stringify({ error: 'Player name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (side !== 'front' && side !== 'back') {
      return new Response(JSON.stringify({ error: "'side' must be either 'front' or 'back'." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (side === 'front') {
      const { imageBase64, team, frontPrompt, prompt } = body;

      if (!imageBase64 || !team) {
        return new Response(JSON.stringify({ error: 'Front generation needs photo and team.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const frontCard = await callGemini(
        await buildFrontPayload({
          playerImage: imageBase64,
          playerName,
          team,
          promptOverride: frontPrompt ?? prompt,
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          frontCard,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statsTemplate = generateRandomStats();
    const { backPrompt, prompt } = body;
    const backCard = await callGemini(
      await buildBackPayload({
        stats: statsTemplate.stats,
        playerName,
        promptOverride: backPrompt ?? prompt,
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
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
        model: TEXT_MODEL, // Switched to cheaper text-only model
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