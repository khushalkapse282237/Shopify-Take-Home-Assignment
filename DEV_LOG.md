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
Built `proxy/src/server.ts` — a Node.js HTTP server that:
- Exposes `GET /stock?variants=gid1,gid2,...`
- Calls Shopify Admin REST API for each variant's inventory quantity
- Returns `{ gid: { qty, low } }` where `low: true` when `qty <= 5`
- Verifies HMAC signature on App Proxy requests (bonus)

Extracted `mapVariantToStock()` into `src/stock-mapper.ts` so it's unit-testable separately.

Fixed `proxy/tsconfig.json` `rootDir` from `"src"` to `".."` (project root) so the proxy can import shared code from `src/stock-mapper.ts` across the directory boundary. Updated `dev:proxy` script path accordingly.

### Why
The Storefront API doesn't include inventory quantities — Shopify intentionally withholds this from public APIs. The Admin API has it but requires a private access token. A server-side proxy is the only architecture that can: (a) have access to the secret token, and (b) serve the browser.

### Key decisions
- **`mapVariantToStock` in its own file**: Pure function, no side effects, easy to test. The proxy imports it; tests import it directly.
- **`Promise.all` for parallel variant fetches**: Fetching N variants sequentially would be N× slower. Parallel is always better here since variant IDs are independent.
- **Error fallback `{ qty: 0, low: true }`**: If a variant fetch fails, we err on the side of caution — assume it might be low stock rather than hiding a potential out-of-stock.
- **CORS headers**: The browser's origin (Shopify store) is different from the proxy's origin (localhost/ngrok). Without `Access-Control-Allow-Origin: *`, all browser calls would fail with a CORS error.
- **HMAC verification**: In production, Shopify signs every App Proxy request. Verifying the signature ensures only Shopify-forwarded requests are accepted, preventing unauthorized access.
- **`rootDir: ".."` in proxy/tsconfig.json**: Allows the proxy to import `src/stock-mapper.ts` (outside its own `proxy/src/`) without TypeScript errors. The compiled output path shifts to `proxy/dist/proxy/src/server.js`.
