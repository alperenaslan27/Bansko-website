// Logic for the "In our own words" wall: list, add and remove stories.
// Kept separate from the Netlify wrapper so it can be tested with a fake store.
import { createHash, timingSafeEqual } from "node:crypto";
import { hasBadWords, hasContactOrLink } from "./filter.mjs";

export const COUNTRIES = ["Bulgaria", "Greece", "Italy", "Romania", "Spain", "Türkiye", "Other"];
const WALL_KEY = "wall";
const MAX_STORIES = 500;
const LIMITS = { name: 30, minText: 15, maxText: 600 };
const RATE = { perTenMinutes: 3, perDay: 10 };

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

async function readWall(store) {
  const r = await store.getWithMetadata(WALL_KEY, { type: "json" });
  return { stories: (r && Array.isArray(r.data?.stories)) ? r.data.stories : [], etag: r?.etag };
}

// Read, change and write back, retrying if someone else wrote in between.
async function updateWall(store, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { stories, etag } = await readWall(store);
    const next = change(stories.slice());
    if (next === null) return stories;
    const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const res = await store.setJSON(WALL_KEY, { stories: next }, opts);
    if (res && res.modified !== false) return next;
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 200));
  }
  throw new Error("busy");
}

function publicStory(s) {
  return { id: s.id, name: s.name, country: s.country, text: s.text, at: s.at };
}

// The admin key is never stored in the code, only its SHA-256 fingerprint,
// so the public repository does not reveal it. An ADMIN_KEY environment variable also works if one is set.
function keyMatches(given, expected, expectedHash) {
  if (!given) return false;
  if (expected && expected.length >= 12) {
    const a = Buffer.from(String(given)), b = Buffer.from(String(expected));
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  if (expectedHash && /^[0-9a-f]{64}$/.test(expectedHash)) {
    const a = createHash("sha256").update(String(given)).digest(), b = Buffer.from(expectedHash, "hex");
    return timingSafeEqual(a, b);
  }
  return false;
}

async function checkRate(store, ip, now) {
  const id = createHash("sha256").update("a4c-salt:" + (ip || "unknown")).digest("hex").slice(0, 32);
  const key = "rate/" + id;
  const prev = (await store.get(key, { type: "json" })) || { t: [] };
  const recent = prev.t.filter((x) => now - x < 24 * 3600e3);
  const lastTen = recent.filter((x) => now - x < 600e3);
  if (lastTen.length >= RATE.perTenMinutes || recent.length >= RATE.perDay) return false;
  recent.push(now);
  await store.setJSON(key, { t: recent });
  return true;
}

export async function handle(req, { store, ip, adminKey, adminKeyHash, now = Date.now() }) {
  const method = req.method.toUpperCase();

  if (method === "GET") {
    const { stories } = await readWall(store);
    return json(200, { stories: stories.slice().reverse().map(publicStory) });
  }

  if (method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json(400, { error: "We couldn't read that. Please try again." }); }
    // Hidden field that people never see; bots fill it in.
    if (clean(body.website)) return json(200, { ok: true, stories: [] });
    const name = clean(body.name).replace(/\s+/g, " ");
    const country = clean(body.country);
    const text = clean(body.text);
    if (!name || name.length > LIMITS.name || !/^[\p{L}][\p{L} .'-]*$/u.test(name))
      return json(400, { error: "Please write your first name using letters only (up to 30)." });
    if (!COUNTRIES.includes(country)) return json(400, { error: "Please choose your country." });
    if (text.length < LIMITS.minText) return json(400, { error: "Please write a little more, at least a sentence." });
    if (text.length > LIMITS.maxText) return json(400, { error: `Please keep it under ${LIMITS.maxText} characters.` });
    if (hasBadWords(name) || hasBadWords(text))
      return json(422, { error: "Your story contains words we don't allow on this site. Please rephrase it and try again." });
    if (hasContactOrLink(text))
      return json(422, { error: "Please leave out links, e-mail addresses and phone numbers." });
    if (!(await checkRate(store, ip, now)))
      return json(429, { error: "You've shared a few stories already. Please wait a while before adding another." });
    const story = { id: now.toString(36) + Math.random().toString(36).slice(2, 7), name, country, text, at: new Date(now).toISOString() };
    try {
      const all = await updateWall(store, (list) => {
        if (list.some((s) => s.text === text && s.name === name)) return null; // double click
        list.push(story);
        return list.slice(-MAX_STORIES);
      });
      return json(201, { ok: true, story: publicStory(story), stories: all.slice().reverse().map(publicStory) });
    } catch {
      return json(503, { error: "The wall is busy right now. Please try again in a moment." });
    }
  }

  if (method === "DELETE") {
    if (!keyMatches(req.headers.get("x-admin-key"), adminKey, adminKeyHash)) return json(401, { error: "Wrong admin key." });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json(400, { error: "Missing story id." });
    try {
      const all = await updateWall(store, (list) => {
        const next = list.filter((s) => s.id !== id);
        return next.length === list.length ? null : next;
      });
      return json(200, { ok: true, stories: all.slice().reverse().map(publicStory) });
    } catch {
      return json(503, { error: "Busy, please try again." });
    }
  }

  return json(405, { error: "Method not allowed." });
}
