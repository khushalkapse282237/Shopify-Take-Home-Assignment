"use strict";(()=>{var y=`
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
`;function S(e){let n=parseFloat(e.amount);return new Intl.NumberFormat("en-GB",{style:"currency",currency:e.currencyCode}).format(n)}function v(e){let n=e.dataset.sectionId??"",r=e.dataset.collectionHandle??"",t=e.dataset.storefrontToken??"",c=parseInt(e.dataset.productCount??"4",10),o=e.dataset.proxyUrl??"",a=window.Shopify?.shop??window.location.hostname;return!r||!t?null:{sectionId:n,collectionHandle:r,storefrontToken:t,productCount:c,proxyUrl:o,shopDomain:a}}async function h(e){try{let n=`https://${e.shopDomain}/api/2024-10/graphql.json`,r=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Storefront-Access-Token":e.storefrontToken},body:JSON.stringify({query:y,variables:{handle:e.collectionHandle,count:e.productCount}})});if(!r.ok)return null;let t=await r.json();return t.errors&&t.errors.length>0?null:t.data.collection?.products.nodes??null}catch{return null}}async function d(e,n){if(!n||e.length===0)return null;try{let r=new URLSearchParams({variants:e.join(",")}),t=await fetch(`${n}?${r.toString()}`);return t.ok?await t.json():null}catch{return null}}function b(e,n){e.innerHTML=Array.from({length:n}).map(()=>`
      <div class="fcs-card fcs-card--skeleton" aria-hidden="true">
        <div class="fcs-skeleton fcs-skeleton--image"></div>
        <div class="fcs-card__body">
          <div class="fcs-skeleton fcs-skeleton--title"></div>
          <div class="fcs-skeleton fcs-skeleton--price"></div>
          <div class="fcs-skeleton fcs-skeleton--link"></div>
        </div>
      </div>`).join("")}function u(e,n,r){e.innerHTML=n.map(t=>{let c=t.variants.nodes[0]?.id??"",o=t.featuredImage?`<img
            src="${t.featuredImage.url}"
            alt="${t.featuredImage.altText??t.title}"
            loading="lazy"
            class="fcs-card__image"
          />`:'<div class="fcs-card__image-placeholder"></div>',a=t.badgeLabel?`<span class="fcs-badge">${t.badgeLabel.value}</span>`:"",i=S(t.priceRange.minVariantPrice);return`
        <div
          class="fcs-card"
          data-product-handle="${t.handle}"
          data-variant-gid="${c}"
        >
          <div class="fcs-card__image-wrap">
            ${a}
            ${o}
          </div>
          <div class="fcs-card__body">
            <h3 class="fcs-card__title">${t.title}</h3>
            <p class="fcs-card__price">${i}</p>
            <a href="/products/${t.handle}" class="fcs-card__link">
              View product \u2192
            </a>
          </div>
        </div>`}).join("")}function f(e,n){e.querySelectorAll("[data-variant-gid]").forEach(t=>{let c=t.dataset.variantGid;if(!c)return;if(n[c]?.low){let a=t.querySelector(".fcs-card__body");if(a&&!a.querySelector(".fcs-low-stock")){let i=document.createElement("span");i.className="fcs-low-stock",i.textContent="Low stock";let s=a.querySelector(".fcs-card__price");s?s.insertAdjacentElement("afterend",i):a.prepend(i)}}})}function P(e,n){return n==="featured"?[...e]:[...e].sort((r,t)=>{let c=parseFloat(r.priceRange.minVariantPrice.amount),o=parseFloat(t.priceRange.minVariantPrice.amount);return n==="price-asc"?c-o:o-c})}function L(e){let n=e.querySelector(".fcs-sort");if(n)return n;let r=document.createElement("div");r.className="fcs-sort-wrap",r.innerHTML=`
    <label class="fcs-sort-label" for="fcs-sort-${e.dataset.sectionId}">Sort by:</label>
    <select class="fcs-sort" id="fcs-sort-${e.dataset.sectionId}">
      <option value="featured">Featured</option>
      <option value="price-asc">Price: Low \u2192 High</option>
      <option value="price-desc">Price: High \u2192 Low</option>
    </select>`;let t=e.querySelector(".fcs-header");return t&&t.insertAdjacentElement("afterend",r),r.querySelector(".fcs-sort")}function p(e){let n=v(e);if(!n)return;let r=e.querySelector("[data-product-grid]");if(!r)return;let t=[];async function c(){b(r,n.productCount);let o=await h(n);if(!o){r.innerHTML='<p class="fcs-empty">Could not load products.</p>';return}t=o;let a=L(e);u(r,o,n);let i=o.map(s=>s.variants.nodes[0]?.id).filter(s=>!!s);d(i,n.proxyUrl).then(s=>{s&&f(r,s)}),a.addEventListener("change",()=>{let s=a.value,g=P(t,s);u(r,g,n),d(i,n.proxyUrl).then(l=>{l&&f(r,l)})})}"IntersectionObserver"in window?new IntersectionObserver((a,i)=>{a.forEach(s=>{s.isIntersecting&&(i.unobserve(e),c())})},{rootMargin:"200px"}).observe(e):c()}function m(){document.querySelectorAll("[data-section-id][data-collection-handle]").forEach(p)}document.addEventListener("shopify:section:load",e=>{let n=e,r=document.querySelector(`[data-section-id="${n.detail.sectionId}"]`);r&&p(r)});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",m):m();})();
