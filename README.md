# ACT 4 Change: #NoBullying website

Website of the Erasmus+ youth exchange in Bansko, Bulgaria, 5–15 October 2026.

Live site: https://act4change-no-bullying.netlify.app/

## How to edit

- The page is one file: `index.html`.
- Photos are in `photos`, outcome videos and files in `outcomes`, post screenshots in `social`.
- Every change you commit and push in GitHub Desktop is published by Netlify in about a minute.
  On the free plan each publish uses 15 of the 300 monthly credits, so group your changes into fewer pushes.

## "In our own words" wall

- Visitors post through `/api/stories`, a Netlify Function in `netlify/functions/stories.mjs`.
  Posts are stored in Netlify Blobs (store name `stories`).
- Blocked words, links, e-mails and phone numbers are checked in `netlify/lib/filter.mjs`.
  A copy of the same rules runs in `index.html` for instant feedback; if you change the list, change both.
- To remove a post: open the site with `#admin` at the end of the address,
  enter the admin key, then use Remove (click twice).
- The admin key itself is not in this repository, only its SHA-256 fingerprint in
  `netlify/functions/stories.mjs`. To change the key, replace that fingerprint with the one of the
  new key (on a Mac: `echo -n "new-key" | shasum -a 256`) and push.
