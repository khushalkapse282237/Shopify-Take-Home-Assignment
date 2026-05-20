# Dev Log — Valar Digital Take-Home Assignment

A running log of decisions made during implementation.

---

## Phase 0 — Repository Initialization
**Date:** 2026-05-20

### What I did
Set up the project scaffold: package.json, TypeScript configs (one for browser frontend, one for Node.js proxy), .gitignore, .env.example, and skeleton README/DEV_LOG.

### Why
Two separate tsconfig files are needed because the frontend TypeScript targets the browser (DOM lib, ES modules, bundled by esbuild) while the proxy targets Node.js (CommonJS modules, no DOM). Using a single tsconfig would force compromises on both.

### Key decisions
- **esbuild over tsc for frontend**: esbuild bundles everything into one file for Shopify's assets pipeline. tsc would produce multiple files which Shopify can't serve without a bundler step anyway.
- **Committed `assets/featured-collection.js`**: Shopify reviewers need to upload this file directly. Not gitignoring it means they can grab it from the repo.
- **`.env` gitignored, `.env.example` committed**: Standard practice — the template is visible, the secrets are not.

---

## Phase 1 — Liquid Theme Section
**Date:** 2026-05-20

### What I did
Created `theme/sections/featured-collection-showcase.liquid` with:
- Section schema: collection picker, heading text, product count (2–8)
- Liquid product card baseline rendering with featured image, title, price, and view link
- Highlight blocks strip with icon, label, sub-label
- `data-*` attributes on the section wrapper for TypeScript to read

### Why
The Liquid baseline ensures the section is usable even if JavaScript is blocked or fails. Progressive enhancement: start with working HTML, layer JS on top.

### Key decisions
- **`{{ block.shopify_attributes }}`**: Required for drag-and-drop in the theme editor. Without it, the editor's JS can't find the block DOM elements.
- **`data-variant-gid` on each card**: The full GID format (`gid://shopify/ProductVariant/ID`) is what the Storefront API and our proxy use. Constructing it in Liquid avoids string manipulation in TypeScript.
- **`defer` on script tag**: Prevents the JS bundle from blocking HTML parsing. The Liquid baseline is visible immediately; JS enhances it after parse.
- **Proxy URL as a section setting**: Allows the merchant (or developer) to update the proxy URL from the theme editor without touching code. Important for local dev (ngrok URL changes every restart).

---

## Phase 2 — TypeScript Storefront Client
**Date:** 2026-05-20

### What I did
Created `src/featured-collection.ts` — compiles to `assets/featured-collection.js`.

Features:
- Typed interfaces for the full Storefront API response (no `any`)
- IntersectionObserver defers fetch until section enters viewport
- Skeleton loading cards while Storefront API fetch is in-flight
- GraphQL query fetches: title, handle, featured image, price range, `custom.badge_label` metafield
- Re-renders product cards with live data on success
- Non-blocking second fetch to App Proxy for stock levels
- `applyStockBadges()` adds "Low stock" pill to cards where `low === true`
- Client-side sort by price using in-memory products array (no new fetch)
- Fails silently on error — shows a fallback message

### Why
**Progressive enhancement**: The Liquid baseline (Phase 1) gives immediate content. TypeScript enhances it with live data. If the Storefront API call fails, the page still has Liquid-rendered cards.

**Two-fetch pattern**: Cards must appear before the stock check. Stock data is a "nice to have" overlay — blocking card render on stock would be wrong UX.

**IntersectionObserver**: Avoids fetching data for sections the user never scrolls to. Improves performance, especially on long homepages.

### Key decisions
- **No `any` types**: Used strict typed interfaces. The `StorefrontResponse` interface matches the exact GraphQL shape.
- **`declare global { Window.Shopify }`**: Shopify injects `window.Shopify.shop` on every storefront page. Declaring it avoids a type error without using `any`.
- **Sort without refetch**: The `allProducts` array is kept in closure scope. Sort re-renders from memory — fast, no network round-trip.

---

## Phase 3 — App Proxy Stock Endpoint
**Date:** 2026-05-20

### What I did
Created `proxy/src/server.ts` — a Node.js HTTP server that:
- Accepts `GET /stock?variants=gid1,gid2,...`
- Fetches inventory quantity for each variant from the Shopify Admin REST API
- Returns a `Record<string, StockEntry>` keyed by variant GID
- Verifies HMAC signatures on requests from Shopify's App Proxy

### Why
The Storefront API is public — any client can call it. But inventory data requires the Admin API, which needs a private access token. Putting that token in the browser bundle would expose it to anyone who opens DevTools. The proxy keeps the token server-side and returns only the sanitized `{ qty, low }` shape.

### Key decisions
- **`mapVariantToStock` as a pure function**: Isolating the Admin API response → StockEntry mapping into `src/stock-mapper.ts` makes it unit-testable without an HTTP server.
- **HMAC verification**: Shopify signs App Proxy requests with the shared secret. Verifying the signature prevents unauthorized callers from hitting the stock endpoint directly.
- **Parallel Admin API fetches**: `Promise.all` fires one request per variant concurrently rather than sequentially — keeps latency proportional to the slowest single request, not the sum.

---

## Phase 4 — CSS, Responsive Layout & Polish
**Date:** 2026-05-20

### What I did
Created `assets/featured-collection.css` with:
- Design tokens matching the BOTANICA brand (cream bg, DM Serif/Sans fonts)
- 4-col → 2-col → 1-col responsive grid using CSS Grid
- Skeleton shimmer animation (`@keyframes fcs-shimmer`)
- Badge pill styling (green pill for metafield badges)
- Low stock styling (red text, inline)
- Highlight block strip (auto-fit grid)
- Hover effects on product cards

### Why
CSS Grid with `repeat(4, 1fr)` and media queries is the cleanest approach for this layout. The design PDF shows the exact breakpoints (4 col desktop, 2 col tablet, 1 col mobile).

### Key decisions
- **CSS custom properties (variables)**: Design tokens at `:root` level make it easy for Shopify merchants to override brand colors without touching the CSS logic.
- **`aspect-ratio: 1/1` on image wrap**: Ensures product images are always square regardless of their natural dimensions. Prevents layout shifts.
- **Shimmer animation on separate `background-size: 200%`**: Moving the gradient's `background-position` creates the shimmer effect without JavaScript or element cloning.

---

## Phase 5 — Unit Tests
**Date:** 2026-05-20

### What I did
Added `tests/stock-mapper.test.ts` with 12 Vitest unit tests covering the `mapVariantToStock` function.

Tests cover:
- qty field accuracy (4 cases)
- low flag boundary conditions including exact threshold (6 cases)
- Return object shape and immutability (2 cases)

### Why
`mapVariantToStock` is a pure function — no side effects, no HTTP calls, deterministic. Pure functions are the ideal unit-test target. Testing it in isolation gives confidence that the proxy's core logic is correct without needing a real Shopify store.

### Key decisions
- **Boundary test at qty=5**: The threshold is `<= 5`, so exactly 5 should be `low: true` and 6 should be `low: false`. This boundary case is easy to get wrong, so an explicit test is valuable.
- **Immutability test**: Verifies the function doesn't mutate its input. Good practice for pure functions.
- **No mock tests**: The function has no dependencies to mock. If it did, the design would be wrong.

---

## Phase 6 — Documentation
**Date:** 2026-05-20

### What I did
Finalized README.md with:
- Live dev store URL
- Complete setup instructions (prerequisites, env vars, build steps, ngrok setup)
- Architecture diagram explaining the two-fetch pattern
- Project structure overview
- Evaluation notes explaining security decisions

### Why
The README is part of the rubric (10 points for "code structure, README clarity, repo hygiene"). A reviewer should be able to clone the repo and get everything running from the README alone — without needing to ask questions.
