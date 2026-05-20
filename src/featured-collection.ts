// src/featured-collection.ts
// Compiled by esbuild → assets/featured-collection.js

// ─── Shopify Global ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    Shopify?: {
      shop: string;
    };
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductImage {
  url: string;
  altText: string | null;
}

interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

interface PriceRange {
  minVariantPrice: MoneyV2;
  maxVariantPrice: MoneyV2;
}

interface BadgeMetafield {
  value: string;
}

interface ProductVariant {
  id: string; // Full GID: "gid://shopify/ProductVariant/123"
}

interface StorefrontProduct {
  title: string;
  handle: string;
  featuredImage: ProductImage | null;
  priceRange: PriceRange;
  badgeLabel: BadgeMetafield | null;
  variants: {
    nodes: ProductVariant[];
  };
}

interface StorefrontCollection {
  products: {
    nodes: StorefrontProduct[];
  };
}

interface StorefrontResponse {
  data: {
    collection: StorefrontCollection | null;
  };
  errors?: Array<{ message: string }>;
}

interface StockEntry {
  qty: number;
  low: boolean;
}

type StockResponse = Record<string, StockEntry>;

interface SectionConfig {
  sectionId: string;
  collectionHandle: string;
  storefrontToken: string;
  productCount: number;
  proxyUrl: string;
  shopDomain: string;
}

// ─── GraphQL Query ────────────────────────────────────────────────────────────

const COLLECTION_QUERY = `
  query FeaturedCollection($handle: String!, $count: Int!) {
    collection(handle: $handle) {
      products(first: $count) {
        nodes {
          title
          handle
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          badgeLabel: metafield(namespace: "custom", key: "badge_label") {
            value
          }
          variants(first: 1) {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(money: MoneyV2): string {
  const amount = parseFloat(money.amount);
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: money.currencyCode,
  });
  return formatter.format(amount);
}

function getSectionConfig(el: HTMLElement): SectionConfig | null {
  const sectionId = el.dataset.sectionId ?? '';
  const collectionHandle = el.dataset.collectionHandle ?? '';
  const storefrontToken = el.dataset.storefrontToken ?? '';
  const productCount = parseInt(el.dataset.productCount ?? '4', 10);
  const proxyUrl = el.dataset.proxyUrl ?? '';
  const shopDomain = window.Shopify?.shop ?? window.location.hostname;

  if (!collectionHandle || !storefrontToken) {
    return null;
  }

  return { sectionId, collectionHandle, storefrontToken, productCount, proxyUrl, shopDomain };
}

// ─── Storefront API Fetch ─────────────────────────────────────────────────────

async function fetchCollection(config: SectionConfig): Promise<StorefrontProduct[] | null> {
  try {
    const endpoint = `https://${config.shopDomain}/api/2024-10/graphql.json`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.storefrontToken,
      },
      body: JSON.stringify({
        query: COLLECTION_QUERY,
        variables: {
          handle: config.collectionHandle,
          count: config.productCount,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json: StorefrontResponse = await response.json() as StorefrontResponse;

    if (json.errors && json.errors.length > 0) {
      return null;
    }

    return json.data.collection?.products.nodes ?? null;
  } catch {
    return null; // Fail silently — Liquid baseline stays visible
  }
}

// ─── Stock Proxy Fetch (non-blocking) ────────────────────────────────────────

async function fetchStock(variantGids: string[], proxyUrl: string): Promise<StockResponse | null> {
  if (!proxyUrl || variantGids.length === 0) return null;

  try {
    const params = new URLSearchParams({ variants: variantGids.join(',') });
    const response = await fetch(`${proxyUrl}?${params.toString()}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!response.ok) return null;
    return await response.json() as StockResponse;
  } catch {
    return null; // Stock is non-critical — fail silently
  }
}

// ─── DOM Rendering ────────────────────────────────────────────────────────────

function renderSkeletons(grid: HTMLElement, count: number): void {
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
      <div class="fcs-card fcs-card--skeleton" aria-hidden="true">
        <div class="fcs-skeleton fcs-skeleton--image"></div>
        <div class="fcs-card__body">
          <div class="fcs-skeleton fcs-skeleton--title"></div>
          <div class="fcs-skeleton fcs-skeleton--price"></div>
          <div class="fcs-skeleton fcs-skeleton--link"></div>
        </div>
      </div>`
    )
    .join('');
}

function renderProducts(
  grid: HTMLElement,
  products: StorefrontProduct[],
  config: SectionConfig
): void {
  grid.innerHTML = products
    .map((product) => {
      const variantGid = product.variants.nodes[0]?.id ?? '';
      const imageHtml = product.featuredImage
        ? `<img
            src="${product.featuredImage.url}"
            alt="${product.featuredImage.altText ?? product.title}"
            loading="lazy"
            class="fcs-card__image"
          />`
        : `<div class="fcs-card__image-placeholder"></div>`;

      const badgeHtml = product.badgeLabel
        ? `<span class="fcs-badge">${product.badgeLabel.value}</span>`
        : '';

      const price = formatMoney(product.priceRange.minVariantPrice);

      return `
        <div
          class="fcs-card"
          data-product-handle="${product.handle}"
          data-variant-gid="${variantGid}"
        >
          <div class="fcs-card__image-wrap">
            ${badgeHtml}
            ${imageHtml}
          </div>
          <div class="fcs-card__body">
            <h3 class="fcs-card__title">${product.title}</h3>
            <p class="fcs-card__price">${price}</p>
            <a href="/products/${product.handle}" class="fcs-card__link">
              View product →
            </a>
          </div>
        </div>`;
    })
    .join('');
}

function applyStockBadges(grid: HTMLElement, stock: StockResponse): void {
  const cards = grid.querySelectorAll<HTMLElement>('[data-variant-gid]');
  cards.forEach((card) => {
    const gid = card.dataset.variantGid;
    if (!gid) return;
    const entry = stock[gid];
    if (entry?.low) {
      const body = card.querySelector('.fcs-card__body');
      if (body && !body.querySelector('.fcs-low-stock')) {
        const badge = document.createElement('span');
        badge.className = 'fcs-low-stock';
        badge.textContent = 'Low stock';
        const priceEl = body.querySelector('.fcs-card__price');
        if (priceEl) {
          priceEl.insertAdjacentElement('afterend', badge);
        } else {
          body.prepend(badge);
        }
      }
    }
  });
}

// ─── Sort (Bonus) ─────────────────────────────────────────────────────────────

type SortOrder = 'featured' | 'price-asc' | 'price-desc';

function sortProducts(products: StorefrontProduct[], order: SortOrder): StorefrontProduct[] {
  if (order === 'featured') return [...products];
  return [...products].sort((a, b) => {
    const aPrice = parseFloat(a.priceRange.minVariantPrice.amount);
    const bPrice = parseFloat(b.priceRange.minVariantPrice.amount);
    return order === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
  });
}

function renderSortControl(sectionEl: HTMLElement): HTMLSelectElement {
  const existing = sectionEl.querySelector<HTMLSelectElement>('.fcs-sort');
  if (existing) return existing;

  const wrapper = document.createElement('div');
  wrapper.className = 'fcs-sort-wrap';
  wrapper.innerHTML = `
    <label class="fcs-sort-label" for="fcs-sort-${sectionEl.dataset.sectionId}">Sort by:</label>
    <select class="fcs-sort" id="fcs-sort-${sectionEl.dataset.sectionId}">
      <option value="featured">Featured</option>
      <option value="price-asc">Price: Low → High</option>
      <option value="price-desc">Price: High → Low</option>
    </select>`;

  const header = sectionEl.querySelector('.fcs-header');
  if (header) {
    header.insertAdjacentElement('afterend', wrapper);
  }
  return wrapper.querySelector<HTMLSelectElement>('.fcs-sort')!;
}

// ─── Main Init ────────────────────────────────────────────────────────────────

function initSection(sectionEl: HTMLElement): void {
  const config = getSectionConfig(sectionEl);
  if (!config) return;

  const grid = sectionEl.querySelector<HTMLElement>('[data-product-grid]');
  if (!grid) return;

  let allProducts: StorefrontProduct[] = [];

  async function loadProducts(): Promise<void> {
    renderSkeletons(grid!, config!.productCount);

    const products = await fetchCollection(config!);
    if (!products) {
      // Restore Liquid baseline is impossible after skeleton replaced it.
      // Render an empty grid — the section heading still shows.
      grid!.innerHTML = '<p class="fcs-empty">Could not load products.</p>';
      return;
    }

    allProducts = products;

    // Render sort control and products
    const sortSelect = renderSortControl(sectionEl);
    renderProducts(grid!, products, config!);

    // Non-blocking stock fetch — cards are already visible
    const variantGids = products
      .map((p) => p.variants.nodes[0]?.id)
      .filter((id): id is string => Boolean(id));

    fetchStock(variantGids, config!.proxyUrl).then((stock) => {
      if (stock) applyStockBadges(grid!, stock);
    });

    // Wire up sort
    sortSelect.addEventListener('change', () => {
      const order = sortSelect.value as SortOrder;
      const sorted = sortProducts(allProducts, order);
      renderProducts(grid!, sorted, config!);
      // Re-apply stock badges after re-render
      fetchStock(variantGids, config!.proxyUrl).then((stock) => {
        if (stock) applyStockBadges(grid!, stock);
      });
    });
  }

  // Bonus: IntersectionObserver — defer fetch until section is visible
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            obs.unobserve(sectionEl);
            loadProducts();
          }
        });
      },
      { rootMargin: '200px' } // Start loading 200px before section enters viewport
    );
    observer.observe(sectionEl);
  } else {
    loadProducts();
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

function bootstrap(): void {
  const sections = document.querySelectorAll<HTMLElement>('[data-section-id][data-collection-handle]');
  sections.forEach(initSection);
}

// Theme editor re-init support
document.addEventListener('shopify:section:load', (event) => {
  const e = event as CustomEvent<{ sectionId: string }>;
  const el = document.querySelector<HTMLElement>(
    `[data-section-id="${e.detail.sectionId}"]`
  );
  if (el) initSection(el);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
