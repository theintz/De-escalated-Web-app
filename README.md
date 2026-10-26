# Non-Escalator Relationship Menu

A static web app for two people to fill out a non-escalator relationship menu on their own and then compare their answers.

## How it works

1. Each person rates every item: **Must have**, **Like to have**, **Maybe** or **Off limits**.
2. Each person gets a code (e.g. `110ZT-ET0KJ-…`) and a share link (`https://…/#110ZTET0KJ…`), sent with a **Send via WhatsApp** button, the phone's share sheet, or copy and paste.
3. Entering the partner's code, or opening their link, shows both sets of answers side by side. It only works once you've submitted your own answers.

Results are grouped into tiers:

| Tier | Meaning |
|---|---|
| Match | Same answer |
| Close | Must have vs. like to have |
| Discuss | At least one "maybe" |
| Conflict | Must or like to have vs. off limits |
| Unanswered | At least one person skipped the item |

## Stateless by design

There is no backend. The code is the answers themselves: 78 answers packed as a base-5 number, written in Crockford base32, with a version prefix and a checksum character. The share link puts the code in the URL fragment (`#CODE`, letters and digits only), so it survives being pasted into any messenger and is never sent to the server. Drafts and codes are kept in the browser's `localStorage` for convenience.

Anyone who has a code can decode its answers. The code is not encrypted.

**Changing the menu:** codes store answers by position. Don't reorder, add or remove items in `js/menu.js` without bumping `CODE_VERSION`. Otherwise old codes will decode to the wrong items.

## Development

No build step. Open `index.html` directly, or serve the folder:

```sh
npm start   # serves on http://localhost:8000
npm test    # unit tests for encoding and matching (Node 18+)
```

## Deployment

It's a plain static site, so any static host works. Publish the repository root:

- **GitHub Pages**: Settings → Pages → deploy from branch, folder `/ (root)`. Free for public repos; private repos need a paid plan.
- **Netlify / Vercel / Cloudflare Pages**: import the GitHub repo with no build command and the output directory set to the repository root. Free tier, deploys on every push.
