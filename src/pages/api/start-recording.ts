// src/pages/api/start-recording.ts
import type { APIRoute } from 'astro';
import { spawn } from 'child_process';
import { setRecordingStatus, setPlayer } from '../../lib/cardStore';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { mode, name, team, sport, photo } = body;

    if (!mode || !name || !team) {
      return new Response(JSON.stringify({ error: 'Missing mode, name, or team' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store player info so generate-card can attach it to the card
    setPlayer({ name, team, sport: sport ?? 'baseball', photo: photo ?? null });
    setRecordingStatus('recording', mode);

    // Spawn the Python script with mode as a CLI arg
    // Adjust the path to wherever test_swing_pi.py lives on your machine
    const script = spawn('python', ['baseball_pi.py', '--mode', mode, '--headless'], {
      cwd: 'vision',
      detached: true,
      stdio: 'ignore',
    });

    script.on('error', (err) => {
      console.error('Failed to start Python script:', err);
      setRecordingStatus('error', mode, err.message);
    });

    script.unref(); // don't block Node when script exits

    return new Response(JSON.stringify({ success: true, mode }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('start-recording error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};