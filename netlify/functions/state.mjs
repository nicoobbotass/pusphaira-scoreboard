// Shared scoreboard state, stored in Netlify Blobs.
//   GET  /api/state         -> the saved state object (or null); sends x-pusphaira-role + x-pusphaira-auth
//   GET  /api/state?debug=1 -> { authOn, hasEditKey, hasViewKey }  (no secrets, for setup checks)
//   PUT  /api/state  {..}   -> replaces the saved state (edit role only)
// Last write wins. Fine for one coach using one device at a time.
//
// Passwords are OPT-IN. Set these as Netlify environment variables to turn them on:
//   PUSPHAIRA_EDIT_KEY  - full access (open the app, change scores). Required to enable auth.
//   PUSPHAIRA_VIEW_KEY  - optional read-only access (open the app, see standings, no edits).
// With no PUSPHAIRA_EDIT_KEY set, the endpoint stays open (no password).
import { getStore } from "@netlify/blobs";

const DOC = "state";

// Read env per-request (not at module load) so there's no init-timing ambiguity.
function keys() {
  return {
    edit: (process.env.PUSPHAIRA_EDIT_KEY || "").trim(),
    view: (process.env.PUSPHAIRA_VIEW_KEY || "").trim()
  };
}
function roleFor(req) {
  const { edit, view } = keys();
  if (!edit) return "edit";                          // no passwords configured -> open
  const k = (req.headers.get("x-pusphaira-key") || "").trim();
  if (k && k === edit) return "edit";
  if (k && view && k === view) return "view";
  return null;                                       // missing / wrong key
}

export default async (req) => {
  const { edit, view } = keys();
  const authOn = !!edit;

  if (req.method === "GET" && new URL(req.url).searchParams.get("debug") === "1") {
    return json({ authOn, hasEditKey: !!edit, hasViewKey: !!view });
  }

  const role = roleFor(req);
  if (role === null) return json({ error: "unauthorized" }, 401, { "x-pusphaira-auth": "on" });

  let store;
  try { store = getStore("pusphaira"); }
  catch (e) { return json({ error: "blobs unavailable: " + msg(e) }, 500); }

  const meta = { "x-pusphaira-role": role, "x-pusphaira-auth": authOn ? "on" : "off" };

  try {
    if (req.method === "GET") {
      const data = await store.get(DOC, { type: "json" });
      return json(data ?? null, 200, meta);
    }
    if (req.method === "PUT" || req.method === "POST") {
      if (role !== "edit") return json({ error: "read-only key" }, 403, meta);
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "expected a JSON object" }, 400, meta);
      }
      await store.setJSON(DOC, body);
      return json({ ok: true, updatedAt: body.updatedAt ?? null }, 200, meta);
    }
    return json({ error: "method not allowed" }, 405, meta);
  } catch (e) {
    return json({ error: msg(e) }, 500, meta);
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
