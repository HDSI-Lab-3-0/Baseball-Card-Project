// src/pages/api/status.ts
// Kiosk polls this to know when recording is done and card is ready.
import type { APIRoute } from 'astro';
import { getStatus } from '../../lib/cardStore';

export const prerender = false;

export const GET: APIRoute = async () => {
  const status = getStatus();
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};