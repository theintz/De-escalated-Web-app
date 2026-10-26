# Non-Escalator Relationship Menu

A static web app for two people to fill out a non-escalator relationship menu on their own and then compare their answers.

## How it works

1. Person A fills out the menu and rates items as **Must have**, **Like to have**, **Maybe** or **Off limits**. Any item can be skipped. A can add up to 10 custom items (60 characters each).
2. **Get my link** creates a link with A's answers. A sends it with **Send via WhatsApp**, the phone's share sheet, or copy and paste.
3. Person B opens the link and goes straight to the form, which includes A's custom items. B can't add more, so both rate the same list. **Show results** reveals the comparison at any time.
4. The results page has B's link, so B can send their answers back. When A opens it, A goes straight to the results.

Results are grouped into tiers:

| Tier | Meaning |
|---|---|
| Match | Same answer |
| Close | Must have vs. like to have |
| Discuss | At least one "maybe" |
| Conflict | Must or like to have vs. off limits |
| Unanswered | At least one person skipped the item |

## Stateless by design

There is no backend. Everything lives in the link's fragment (`#…`), which browsers never send to the server:

- `#<answers>`: the fixed items' answers, packed as a base-5 number in Crockford base32, with a version prefix and a checksum. It's 39 characters, short enough to type as a code.
- `#<answers>.<custom>`: when there are custom items, their category, rating and text, base64url-encoded with a checksum. A damaged or cut-off link is detected and reported.

Custom items are matched by category and text. Drafts and links are also kept in the browser's `localStorage` for convenience. Anyone who has a link can decode its answers; nothing is encrypted.

**Changing the menu:** answers are stored by position ("slot"). Never reorder or remove the plain-string items in `js/menu.js`. To add an item, write it as `{ text, slot }` with the next unused slot, anywhere in its category. Older links then show it as unanswered. The 39-character code has room for exactly 79 items, which the menu now uses. Adding an 80th item also needs a decoder change, or old codes will be rejected as the wrong length.

## Development

No build step. Open `index.html` directly, or serve the folder:

```sh
npm start   # serves on http://localhost:8000
npm test    # unit tests for encoding and matching (Node 18+)
```

## Deployment

`.github/workflows/pages.yml` runs the tests on every push. On the default branch, it then deploys `index.html`, `css/` and `js/` to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then re-run the workflow, or push again. The site is served at `https://theintz.github.io/De-escalated-Web-app/`.

Any other static host (Netlify, Vercel, Cloudflare Pages) also works: set no build command and use the repository root as the output directory.
