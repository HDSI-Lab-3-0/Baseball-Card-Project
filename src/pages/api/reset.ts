// src/pages/api/reset.ts
// Called when user taps "Play Again" to clear state for next player.
import type { APIRoute } from 'astro';
import { resetStore } from '../../lib/cardStore';

export const prerender = false;

export const POST: APIRoute = async () => {
  resetStore();
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};