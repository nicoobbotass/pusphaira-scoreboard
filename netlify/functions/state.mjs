// Shared scoreboard state, stored in Netlify Blobs.
//   GET  /api/state        -> the saved state object (or null); also sends x-pusphaira-role
//   PUT  /api/state  {..}  -> replaces the saved state (edit role only)
// Last write wins. Fine for one coach using one device at a time.
//
// Passwords are OPT-IN. Set these as Netlify environment variables to turn them on:
//   PUSPHAIRA_EDIT_KEY  - full access (open the app, change scores). Required to enable auth.
//   PUSPHAIRA_VIEW_KEY  - optional read-only access (open the app, see standings, no edits).
// With no PUSPHAIRA_EDIT_KEY set, the endpoint stays open (no password).
import { getStore } from "@netlify/blobs";

const DOC = "state";
const EDIT_KEY = process.env.PUSPHAIRA_EDIT_KEY || "";
const VIEW_KEY = process.env.PUSPHAIRA_VIEW_KEY || "";
const AUTH_ON  = !!EDIT_KEY;

function roleFor(req) {
  if (!AUTH_ON) return "edit";                       // no passwords configured -> open
  const k = req.headers.get("x-pusphaira-key") || "";
  if (EDIT_KEY && k === EDIT_KEY) return "edit";
  if (VIEW_KEY && k === VIEW_KEY) return "view";
  return null;                                       // missing / wrong key
}

export default async (req) => {
  const role = roleFor(req);
  if (role === null) return json({ error: "unauthorized" }, 401);

  let store;
  try { store = getStore("pusphaira"); }
  catch (e) { return json({ error: "blobs unavailable: " + msg(e) }, 500); }

  try {
    if (req.method === "GET") {
      const data = await store.get(DOC, { type: "json" });
      return json(data ?? null, 200, { "x-pusphaira-role": role });
    }
    if (req.method === "PUT" || req.method === "POST") {
      if (role !== "edit") return json({ error: "read-only key" }, 403);
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
function json(obj, status = 200, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { "content-type": "application/json", "cache-control": "no-store" },
      extra || {}
    )
  });
}

export const config = { path: "/api/state" };
