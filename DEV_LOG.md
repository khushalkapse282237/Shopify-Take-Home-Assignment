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
