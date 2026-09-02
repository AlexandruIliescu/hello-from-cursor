# ContextDrop — Pain Validation

**Date:** 2026-09-02  
**Hypothesis:** Everyday AI users repeatedly copy-paste web pages into ChatGPT/Claude, waste tokens on chrome/nav clutter, lose formatting, and want a one-click “send clean context to AI” bridge — not another bookmark archive.

## Evidence gathered

### 1. Documented workflow pain
- [Web2MD / HN / DEV](https://web2md.org/blog/copy-paste-chatgpt-formatting-broken-fix): copy-paste from browsers into ChatGPT breaks code blocks, tables, and formatting; “I was tired of copy-pasting to ChatGPT, so I built a Chrome extension” is a recurring builder story.
- [DEV: Stop pasting webpages](https://dev.to/zephyr_whimsy_e62111ac412/stop-pasting-webpages-into-chatgpt-you-are-wasting-65-of-your-tokens-402e): raw paste wastes ~65% of tokens on nav, cookie banners, related widgets; server-side readers fail on Reddit, X, paywalls, logged-in docs — **browser-side extraction wins**.

### 2. Existing store demand (gap = action + library + monetization)
Chrome Web Store already has markdown clippers (LLMFeeder, Web Page to LLM Context, Minibase). Reviews and listings emphasize:
- Clean Markdown for ChatGPT/Claude/Gemini
- Multi-tab / token counting
- Privacy / local-first

**Gap ContextDrop fills:** not “copy Markdown only,” but **prompt packs → send to AI + history + templates + freemium sync path** (action bridge → SaaS), per product strategy.

### 3. Why not AI bookmarks
Markwise, Bookmarkjar, ClippedNote, Revisit, Marqly, Raindrop already own “save / summarize / ask library.” Validation supports an **action** product (send to AI now), not filing.

## Clickable mock
Open [`mock/index.html`](../mock/index.html) in a browser to walk the one-click flow: capture page → choose template → send to ChatGPT / copy.

## Go / no-go
**GO.** Pain is frequent, buyers already use ChatGPT daily, competitors prove demand, differentiation is clear (send + packs + Pro sync later).