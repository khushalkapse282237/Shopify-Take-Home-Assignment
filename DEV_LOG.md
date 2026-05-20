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
