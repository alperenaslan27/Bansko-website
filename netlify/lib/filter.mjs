// Bad-word filter for the "In our own words" wall.
// The same rules run in the browser (for instant feedback) and on the server (the real check).
// Entries are written in their normalised form: lower case, no accents, Turkish ı as i, Greek final ς as σ.
//   word    blocks the exact word
//   word*   blocks any word that starts with it (word, words, wordy...)
//   *word*  blocks any word that contains it
// Phrases (with spaces) are matched against the whole normalised text.

export const WORDS = [
  // English
  "fuck*", "*fuck*", "shit", "shits", "shitty", "shitting", "shithole*", "shithead*", "bullshit*", "horseshit", "bitch*", "bastard*", "asshole*", "ass", "arse", "arsehole*", "dick", "dickhead*",
  "cock", "cocksucker*", "cunt*", "pussy", "wanker*", "twat*", "slut*", "whore*", "retard*", "faggot*", "fag", "fags",
  "nigger*", "nigga*", "kys", "dumbass*", "jackass*", "motherfucker*",
  // Turkish
  "amk", "aq", "aminakoy*", "aminakoyim", "amcik*", "*orospu*", "picler", "piclik", "*siktir*",
  "sikerim", "sikeyim", "sikik", "sik", "sikis*", "sikim", "siktim", "yarrak*", "yarak", "gotveren*", "ibne*", "kahpe*",
  "pezevenk*", "serefsiz*", "gavat*", "kaltak*", "yavsak*", "pust", "pustt",
  // Italian
  "cazzo", "cazzi", "cazzata*", "cazzone*", "*fanculo*", "stronz*", "puttan*", "troia", "troie", "merda*", "coglion*",
  "minchia*", "porcodio", "porcamadonna", "frocio*", "froci", "ricchion*", "zoccola*", "mignotta*", "bastardo*", "bastarda*",
  // Spanish
  "puta*", "puto*", "hijoputa*", "mierda*", "joder", "jodete", "jodido*", "cabron*", "gilipollas", "pendejo*", "maricon*",
  "zorra", "zorras", "capullo*", "follar*", "chinga*", "pinche", "culero*", "mamon*", "polla", "pollas", "verga",
  // Romanian
  "pula", "pulii", "pizda*", "muie", "muist*", "futu", "futui", "fututi", "futeti", "tarfa", "tarfe", "poponar*",
  "bulangiu*", "labagiu*", "cacat",
  // Bulgarian (Cyrillic and Latin)
  "путка*", "пичка*", "педераст*", "педал", "педали", "курва*", "курво", "шибан*", "еба", "ебал*", "ебан*", "ебем*",
  "копеле", "копелета", "лайно", "putka*", "pichka*", "kurva*", "shiban*", "ebal*", "eban*", "ebem*", "kopele",
  // Greek (Greek script and Greeklish)
  "μαλακα", "μαλακασ", "μαλακεσ", "μαλακισμενε", "μαλακισμενη", "μαλακισμενοσ", "γαμω*", "γαμησου", "γαμιεσαι",
  "γαμημενε", "γαμημενη", "πουστη*", "πουστησ", "πουτανα*", "καριολη*", "μουνι*", "αρχιδι*", "σκατα",
  "malaka*", "gamw*", "gamiesai", "gamisou", "gamhmene", "poutana*", "pousti*", "kariolh*", "kariolis", "mouni",
];

export const PHRASES = [
  "kill yourself", "go kill yourself", "go die", "hijo de puta", "porco dio", "porca madonna", "sugi pula", "mortii tai",
  "mortii mati", "mamka ti", "мамка ти", "ana sini", "anani sik", "amina koy", "son of a bitch", "piece of shit",
];

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

export function normalise(text) {
  return String(text)
    .replace(/İ/g, "i").replace(/I/g, "i").toLowerCase()
    .replace(/ı/g, "i").replace(/ς/g, "σ")
    .normalize("NFKD").replace(/\p{M}+/gu, "")
    .replace(/[0134578@$!]/g, (c) => LEET[c]);
}

const collapse = (w) => w.replace(/(\p{L})\1+/gu, "$1");

const exact = new Set(), prefix = [], infix = [];
for (const w of WORDS) {
  if (w.startsWith("*") && w.endsWith("*")) infix.push(w.slice(1, -1));
  else if (w.endsWith("*")) prefix.push(w.slice(0, -1));
  else exact.add(w);
}
// Collapsed forms ("fuuuuck" -> "fuck") are only compared for entries that stay 4+ letters long,
// so short words like "ass" never turn into ordinary words like "as".
const collapsedExact = new Set([...exact].map(collapse).filter((w) => w.length >= 4));
const collapsedPrefix = prefix.map(collapse).filter((w) => w.length >= 4);
const collapsedInfix = infix.map(collapse).filter((w) => w.length >= 4);

function badToken(t) {
  if (!t) return false;
  if (exact.has(t) || prefix.some((p) => t.startsWith(p)) || infix.some((p) => t.includes(p))) return true;
  const c = collapse(t);
  if (c === t) return false;
  return collapsedExact.has(c) || collapsedPrefix.some((p) => c.startsWith(p)) || collapsedInfix.some((p) => c.includes(p));
}

// Returns true when the text contains a blocked word or phrase.
export function hasBadWords(text) {
  const n = normalise(text);
  const tokens = n.split(/[^\p{L}]+/u).filter(Boolean);
  if (tokens.some(badToken)) return true;
  // Letters spaced or dotted out: "f u c k", "s.i.k.t.i.r"
  let run = "";
  for (const t of [...tokens, ""]) {
    if (t.length === 1) { run += t; continue; }
    if (run.length >= 3 && badToken(run)) return true;
    run = "";
  }
  const joined = " " + tokens.join(" ") + " ";
  return PHRASES.some((p) => joined.includes(" " + normalise(p) + " "));
}

// Links, e-mail addresses and phone numbers are not allowed, to keep out spam and personal data.
export function hasContactOrLink(text) {
  const s = String(text).toLowerCase();
  return /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|io|ly|me|tk|ru|xyz|link|click|top)\b/.test(s)
    || /[^\s@]+@[^\s@]+\.[a-z]{2,}/.test(s)
    || /(?:\d[\s.-]?){8,}/.test(s);
}
