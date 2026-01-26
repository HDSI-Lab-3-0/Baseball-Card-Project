import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const prerender = false;

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { imageBase64, team, playerName } = await request.json();

    if (!imageBase64 || !team) {
      return new Response(JSON.stringify({ error: 'Missing image or team' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const statsResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a funny baseball card writer. Based on the person's photo, create humorous and creative baseball stats. Be playful and fun, not mean.

Return ONLY valid JSON in this exact format:
{
  "nickname": "A fun baseball nickname",
  "position": "A creative position (can be funny like 'Designated Snacker')",
  "stats": {
    "AVG": ".312",
    "HR": "28",
    "RBI": "94",
    "VIBES": "Immaculate",
    "DRIP": "85",
    "CLUTCH": "94%"
  },
  "funFact": "A one-liner fun fact about this player"
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Create fun baseball card stats for this person. They're a fan of the ${team}. ${playerName ? `Their name is ${playerName}.` : ''} Make it funny and creative!`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const statsText = statsResponse.choices[0]?.message?.content || '';

    let stats;
    try {
      const jsonMatch = statsText.match(/\{[\s\S]*\}/);
      stats = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      stats = {
        nickname: 'The Rookie',
        position: 'Utility Player',
        stats: { AVG: '.275', HR: '12', RBI: '45', VIBES: 'Good', DRIP: '75', CLUTCH: '80%' },
        funFact: 'Still learning the signs from the dugout.',
      };
    }

    return new Response(
      JSON.stringify({ success: true, stats }),
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
}; // <-- POST ends here

export const GET: APIRoute = async () => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say "API connected!" in 3 words or less' }],
      max_tokens: 10,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: response.choices[0]?.message?.content,
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