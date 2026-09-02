# ContextDrop

Chrome extension that turns any webpage into a clean **AI prompt pack** and sends it to ChatGPT, Claude, or Gemini in one click.

Not another bookmark manager — an **action bridge** between the web and AI.

## Repo layout

| Path | Purpose |
| --- | --- |
| [`extension/`](extension/) | Manifest V3 extension (WXT + React + TypeScript) |
| [`server/`](server/) | License verify, Stripe checkout stub, sync, team seats, MCP tools |
| [`mock/`](mock/index.html) | Clickable UX validation mock |
| [`docs/validation.md`](docs/validation.md) | Pain validation notes |
| [`docs/store-listing.md`](docs/store-listing.md) | Chrome Web Store copy + publish checklist |
| [`privacy-policy.html`](privacy-policy.html) | Privacy policy stub for store review |

## Quick start (extension)

```bash
cd extension
npm install
npm run dev      # load unpacked from .output/chrome-mv3
npm run build
npm run zip      # store upload zip
```

Load unpacked: Chrome → `chrome://extensions` → Developer mode → Load unpacked → `extension/.output/chrome-mv3`.

**Shortcut:** `Alt+Shift+D` capture page.

## API server (Pro / sync / MCP)

```bash
cd server
npm install
CONTEXTDROP_LISTEN=1 npm start
# tests
CONTEXTDROP_LISTEN=0 npm test
```

Demo license keys (Options → License key):

- `cd_live_demo_pro`
- `cd_live_demo_team`

## Monetization (implemented gates)

- Free: 10 sends/day, 20 history items
- Pro: unlimited, sync, custom templates, multi-tab packs ($7.99/mo or $59/yr — checkout via API)
- Team: seat list from API ($12–15/seat planned)

License checks hit `POST /v1/license/verify` (server-side). Do not trust client-only flags.

## MCP / scale layer

- `GET /v1/mcp/tools`
- `GET /v1/mcp/packs`
- `POST /v1/mcp/call` with `list_context_packs` / `get_context_pack`

## Clickable mock

Open `mock/index.html` in a browser to walk Capture → Pack → Send without installing the extension.
