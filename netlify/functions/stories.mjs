// Netlify Function behind /api/stories (the "In our own words" wall).
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/wall.mjs";

// SHA-256 fingerprint of the admin key. To change the key, put the fingerprint of the new one here
// (on a Mac: echo -n "new-key" | shasum -a 256).
const ADMIN_KEY_SHA256 = "a53ef8cebc3b82f6b2c07f9c0dfb87007fbfab25e9bde42ed395f0f101ed145c";

export default async (req, context) => {
  const store = getStore({ name: "stories", consistency: "strong" });
  return handle(req, { store, ip: context.ip, adminKey: process.env.ADMIN_KEY, adminKeyHash: ADMIN_KEY_SHA256 });
};

export const config = { path: "/api/stories" };
