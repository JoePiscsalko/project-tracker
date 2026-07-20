// reLink Medical — Project Tracker shared store
// Netlify Function (v2). Holds the whole board in one Netlify Blob so every
// visitor reads and writes the same data instead of their own browser copy.
//
//   GET  /.netlify/functions/store  -> returns the board array, or null if empty
//   POST /.netlify/functions/store  -> saves the board array (whole thing)

import { getStore } from '@netlify/blobs';

const STORE = 'project-tracker';
const KEY = 'board';

export default async (req) => {
  const store = getStore(STORE);

  if (req.method === 'GET') {
    const data = await store.get(KEY, { type: 'json' });
    return json(data ?? null);
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return text('Bad JSON', 400);
    }
    if (!Array.isArray(body)) return text('Expected an array of tasks', 400);
    await store.setJSON(KEY, body);
    return json({ ok: true, count: body.length });
  }

  return text('Method not allowed', 405);
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function text(msg, status = 200) {
  return new Response(msg, { status, headers: { 'Cache-Control': 'no-store' } });
}
