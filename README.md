# Featured Collection Showcase — Valar Digital Take-Home Assignment

A Shopify homepage section for **BOTANICA**, a fictional DTC skincare brand. Built as a take-home assignment for Valar Digital.

---

## Live Dev Store

**Store URL:** `https://botanica-dev-xj2hd1y5.myshopify.com`

## Password for Live Dev Store

**Password:** **beacka**

## Demo Video

**URL:** `https://drive.google.com/file/d/1JE_rF-HOKkzTueoGpab5pW41vm9XFM3Q/view?usp=drive_link`

> The Featured Collection Showcase section is live on the homepage.

---

## What Was Built

A three-layer Shopify section:

1. **Liquid baseline** — Server-rendered product cards. Works without JavaScript.
2. **TypeScript client** — Fetches live data from the Storefront API, renders badge pills, shows skeleton loading state.
3. **Node.js App Proxy** — Proxies Admin API calls server-side so the secret key never reaches the browser.

### Features
- Responsive grid: 4 columns (desktop) → 2 columns (tablet) → 1 column (mobile)
- Skeleton shimmer loading state while Storefront API fetch is in-flight
- `custom.badge_label` metafield rendered as badge pills (e.g. "Bestseller", "New in")
- "Low stock" warning badge — added non-blocking after cards are visible
- Client-side price sort (no extra API call)
- IntersectionObserver — defers both fetches until section scrolls into view
- HMAC signature verification on the App Proxy
- Theme editor support: drag-reorderable highlight blocks, live section settings

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** 8 or higher
- **ngrok** — for exposing the local proxy to the internet: [ngrok.com](https://ngrok.com)
- **GitHub CLI** (`gh`) — for PR workflow (optional)
- A Shopify Partner account with a development store

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `SHOPIFY_ADMIN_API_TOKEN` | Yes | Private Admin API token — from Shopify app credentials |
| `SHOPIFY_SHOP_DOMAIN` | Yes | e.g. `my-store.myshopify.com` |
| `PORT` | No | Port for local proxy server (default: `3000`) |
| `PROXY_SHARED_SECRET` | No | App Proxy shared secret for HMAC verification |

**Never commit `.env`.** It is gitignored.

---

## Build Steps

### 1. Install dependencies
```bash
npm install
```

### 2. Build the TypeScript frontend bundle
```bash
npm run build
```
Output: `assets/featured-collection.js`

### 3. Build the App Proxy server
```bash
npm run build:proxy
```
Output: `proxy/dist/server.js`

### 4. Upload theme files to Shopify

Upload these three files to your Dawn theme (via Shopify CLI or Themes → Edit code):

| Source file | Destination in theme |
|---|---|
| `theme/sections/featured-collection-showcase.liquid` | `sections/` |
| `assets/featured-collection.js` | `assets/` |
| `assets/featured-collection.css` | `assets/` |

### 5. Configure the theme settings

In the Shopify theme editor (Customize):
1. Add the **Featured Collection Showcase** section to the homepage
2. Select your collection
3. Set **Heading text**, **Products to show**
4. Add up to 3 **Highlight blocks**
5. Under **Theme settings → App integrations**, paste your **public Storefront API token**
6. In the section settings, paste the **App Proxy URL** (see next section)

---

## Running the App Proxy Locally

### Start the proxy server
```bash
# Make sure .env is set up first
npm run dev:proxy
```

The server starts at `http://localhost:3000`.

Test it:
```bash
curl "http://localhost:3000/stock?variants=gid://shopify/ProductVariant/YOUR_VARIANT_ID"
```

Expected response:
```json
{
  "gid://shopify/ProductVariant/123456": { "qty": 42, "low": false }
}
```

### Expose to the internet with ngrok
```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok-free.app`).

In the Shopify theme editor → Featured Collection Showcase section settings → **App Proxy URL**, paste:
```
https://abc123.ngrok-free.app/stock
```

> Note: The ngrok URL changes every time you restart ngrok. Update the section setting each time.

---

## Running Tests

```bash
npm test
```

All tests are in `tests/`. Uses Vitest.

---

## Project Structure

```
.
├── theme/
│   └── sections/
│       └── featured-collection-showcase.liquid   Shopify section (Liquid)
├── src/
│   ├── featured-collection.ts                    TypeScript frontend client
│   └── stock-mapper.ts                           Pure function — maps Admin API → StockEntry
├── proxy/
│   ├── src/
│   │   └── server.ts                             Node.js App Proxy server
│   └── tsconfig.json
├── assets/
│   ├── featured-collection.js                    Compiled frontend bundle
│   └── featured-collection.css                   Section styles
├── tests/
│   └── stock-mapper.test.ts                      Vitest unit tests
├── tsconfig.json
├── package.json
├── .env.example
└── DEV_LOG.md
```

---

## Architecture Overview

```
Browser (Shopify storefront)
  │
  ├─ [1] Page loads → Liquid renders baseline product cards immediately
  │
  ├─ [2] JS loads → IntersectionObserver waits for section to enter viewport
  │         └─ Section visible → show skeleton cards
  │                   └─ Fetch 1: Storefront API (GraphQL)
  │                         └─ Success → render real cards with badge pills
  │                                     └─ Fetch 2 (non-blocking): GET /stock
  │                                           └─ Success → add "Low stock" badges
  │
  └─ [Proxy] GET /stock?variants=gid1,gid2
        └─ Node.js server → Shopify Admin REST API (secret token server-side)
                        └─ Returns { gid: { qty, low } }
```

---

## Evaluation Notes

- **App Proxy security**: The `SHOPIFY_ADMIN_API_TOKEN` is only ever in `process.env` on the server. It never appears in any HTTP response or frontend code.
- **Two-fetch pattern**: Product cards are rendered before the stock fetch begins. The stock fetch is fired with `.then()` — not `await` — so it cannot delay card rendering.
- **No `any` types**: All TypeScript interfaces are explicitly defined. See `src/featured-collection.ts` for the full type tree.
- **`{{ block.shopify_attributes }}`**: Present on every highlight block wrapper. Required for theme editor drag-and-drop.
