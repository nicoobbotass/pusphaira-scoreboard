// Shared scoreboard state, stored in Netlify Blobs.
//   GET  /api/state        -> the saved state object, or null if nothing saved yet
//   PUT  /api/state  {..}  -> replaces the saved state
// Last write wins. Fine for one coach using one device at a time.
import { getStore } from "@netlify/blobs";

const DOC = "state";

export default async (req) => {
  let store;
  try { store = getStore("pusphaira"); }
  catch (e) { return json({ error: "blobs unavailable: " + msg(e) }, 500); }

  try {
    if (req.method === "GET") {
      const data = await store.get(DOC, { type: "json" });
      return json(data ?? null);
    }
    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "expected a JSON object" }, 400);
      }
      await store.setJSON(DOC, body);
      return json({ ok: true, updatedAt: body.updatedAt ?? null });
    }
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: msg(e) }, 500);
  }
};

function msg(e) { return String((e && e.message) || e); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

export const config = { path: "/api/state" };
