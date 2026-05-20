// proxy/src/server.ts
// Node.js App Proxy — keeps Shopify Admin API key server-side

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';
import * as dotenv from 'dotenv';
import path from 'path';
import { mapVariantToStock, StockEntry } from '../../src/stock-mapper';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN ?? '';
const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN ?? '';
const PROXY_SECRET = process.env.PROXY_SHARED_SECRET ?? '';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

if (!ADMIN_TOKEN || !SHOP_DOMAIN) {
  console.error(
    'ERROR: SHOPIFY_ADMIN_API_TOKEN and SHOPIFY_SHOP_DOMAIN must be set in .env'
  );
  process.exit(1);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type StockMap = Record<string, StockEntry>;

interface AdminVariantAPIResponse {
  variant: {
    inventory_quantity: number;
  };
}

// ─── HMAC Verification (Bonus) ────────────────────────────────────────────────

function verifyHmac(searchParams: URLSearchParams): boolean {
  if (!PROXY_SECRET) return true;

  const signature = searchParams.get('signature');
  if (!signature) return false;

  const params = [...searchParams.entries()]
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('');

  const digest = crypto
    .createHmac('sha256', PROXY_SECRET)
    .update(params)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Admin API Fetch ──────────────────────────────────────────────────────────

function fetchVariantFromAdmin(numericId: string): Promise<StockEntry> {
  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: SHOP_DOMAIN,
      path: `/admin/api/2024-01/variants/${numericId}.json`,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const parsed: AdminVariantAPIResponse = JSON.parse(body) as AdminVariantAPIResponse;
          resolve(mapVariantToStock({ inventory_quantity: parsed.variant.inventory_quantity }));
        } catch {
          resolve({ qty: 0, low: true });
        }
      });
    });

    req.on('error', () => {
      resolve({ qty: 0, low: true });
    });

    req.end();
  });
}

function extractNumericId(gid: string): string | null {
  const parts = gid.split('/');
  const id = parts[parts.length - 1];
  return id && /^\d+$/.test(id) ? id : null;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(req.url ?? '/', baseUrl);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  if (parsedUrl.pathname === '/stock' && req.method === 'GET') {
    if (PROXY_SECRET && !verifyHmac(parsedUrl.searchParams)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized — HMAC verification failed' }));
      return;
    }

    const variantsParam = parsedUrl.searchParams.get('variants') ?? '';
    const variantGids = variantsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (variantGids.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'variants parameter is required' }));
      return;
    }

    Promise.all(
      variantGids.map(async (gid): Promise<[string, StockEntry]> => {
        const numericId = extractNumericId(gid);
        if (!numericId) {
          return [gid, { qty: 0, low: true }];
        }
        const entry = await fetchVariantFromAdmin(numericId);
        return [gid, entry];
      })
    )
      .then((entries) => {
        const result: StockMap = Object.fromEntries(entries);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })
      .catch(() => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`App Proxy server running on http://localhost:${PORT}`);
  console.log(`Stock endpoint: http://localhost:${PORT}/stock?variants=gid://shopify/ProductVariant/ID`);
  console.log(`Shop: ${SHOP_DOMAIN}`);
});

export default server;
