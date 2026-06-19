// src/pages/api/latest-card.ts
import type { APIRoute } from 'astro';
import { getLatestCard } from '../../lib/cardStore';

export const prerender = false;

export const GET: APIRoute = async () => {
  const card = getLatestCard();

  if (!card) {
    return new Response(JSON.stringify({ ready: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ready: true, ...card }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};