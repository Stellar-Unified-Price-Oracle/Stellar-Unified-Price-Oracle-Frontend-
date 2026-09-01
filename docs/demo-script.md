# 90-Second Demo Script

> Record this for the README "Demo Video" section. Total runtime target: **90 s**.
> Recommended tooling: OBS (screen capture) or Loom; 1080p, dark theme, no mic
> noise gate. Narration should feel confident and unhurried — under 45 words
> per scene.

---

## Scene 1 — Hook (0:00–0:12)

**Screen:** `docker compose up --build` in a terminal, then the dashboard fading in.

**Narration:**
> "Stellar DeFi has a missing layer: a trusted, unified price oracle. We built
> it — and this is the dashboard that ships with it. One command to run."

**On-screen cue:** `docker compose up --build  →  http://localhost:8080`

---

## Scene 2 — Live prices (0:12–0:30)

**Screen:** Dashboard with price cards; wait for a WebSocket price update to flash
(a card value ticks up).

**Narration:**
> "Every price is aggregated from Chainlink, Redstone, Band, and Reflector —
> streamed live over WebSocket, confirmed against REST, with a confidence score
> for every value. No more wiring four incompatible feed providers."

**On-screen cue:** highlight the **Live** badge and the confidence % on a card.

---

## Scene 3 — Filters, search, export (0:30–0:45)

**Screen:** Type a pair in search; open the Filter panel and set a confidence
range; select a few cards; hit **Export CSV**.

**Narration:**
> "Filter by source, confidence, freshness — shareable via URL. Select any
> subset and export it. This is a developer tool, so everything is precise
> and queryable."

**On-screen cue:** the URL bar updating as filters change.

---

## Scene 4 — Price detail + Stellar SDK (0:45–1:02)

**Screen:** Click the `XLM/USD` card → Price Detail page. Point at the **Stellar
Asset** panel, then scroll the paginated history chart and load more.

**Narration:**
> "Every feed resolves to its canonical on-chain Stellar asset — XLM native,
> USDC by Circle, validated with the official Stellar SDK. The paginated chart
> and one-click alerts round out the workflow for Soroban developers."

**On-screen cue:** circle the `XLM (native)` badge and the `USDC:GA5Z…` string.

---

## Scene 5 — API docs + close (1:02–1:30)

**Screen:** API Docs page; run a "try it" request and show the JSON; switch a
snippet to Python.

**Narration:**
> "And the whole thing is documented: REST and WebSocket endpoints, runnable
> snippets in curl, JavaScript, and Python — because the real product is one
> verifiable price API for Stellar. That's the unified oracle Stellar DeFi has
> been missing."

**On-screen cue:** fade to the project wordmark + repo URL.

---

## Checklist before recording

- [ ] Run `docker compose up --build` on a clean machine — it must boot first try.
- [ ] Demo mode is default (`VITE_USE_MOCK=true`) — no backend needed.
- [ ] Dark theme, 1080p, 60 fps capture.
- [ ] Keep the WebSocket **Live** badge visible in scenes 2–4.
- [ ] No internal URLs or localhost:3000 in the frame — use `localhost:8080` or a deployed URL.
- [ ] After recording, upload to YouTube/Loom and paste the link into the README.
