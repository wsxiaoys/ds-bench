"use strict";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build a "/" URL preserving q, page and expand state.
 */
function buildUrl({ q, page, expand }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  for (const brand of expand) {
    params.append("expand", brand);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function renderGroup({ q, page, expand, groupLimit, group }) {
  const { brand, total, items } = group;
  const isExpanded = expand.includes(brand);
  const showMoreNeeded = total > groupLimit && !isExpanded;

  const itemsHtml = items
    .map(
      (item) => `
      <li data-testid="item" data-id="${escapeHtml(item.id)}" class="item">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-meta">popularity: ${escapeHtml(
          item.popularity
        )} &middot; $${escapeHtml(item.price)}</span>
      </li>`
    )
    .join("");

  let showMoreHtml = "";
  if (showMoreNeeded) {
    const href = buildUrl({ q, page, expand: [...expand, brand] });
    const remaining = total - items.length;
    showMoreHtml = `<a class="show-more" data-testid="show-more" href="${escapeHtml(
      href
    )}">Show more (${remaining} more)</a>`;
  }

  return `
    <section data-testid="group" data-brand="${escapeHtml(
      brand
    )}" data-total="${total}" class="group">
      <h2 class="brand-name">${escapeHtml(brand)}</h2>
      <p class="brand-total">${total} product${
    total === 1 ? "" : "s"
  } found</p>
      <ul class="items">${itemsHtml}</ul>
      ${showMoreHtml}
    </section>`;
}

function renderPage({ q, page, totalPages, groups, expand, groupLimit }) {
  const groupsHtml = groups
    .map((group) => renderGroup({ q, page, expand, groupLimit, group }))
    .join("");

  const prevHref = buildUrl({ q, page: page - 1, expand });
  const nextHref = buildUrl({ q, page: page + 1, expand });

  const prevHtml =
    page > 1
      ? `<a data-testid="prev-page" href="${escapeHtml(
          prevHref
        )}" class="page-link">&laquo; Previous</a>`
      : `<span data-testid="prev-page" class="page-link disabled">&laquo; Previous</span>`;

  const nextHtml =
    page < totalPages
      ? `<a data-testid="next-page" href="${escapeHtml(
          nextHref
        )}" class="page-link">Next &raquo;</a>`
      : `<span data-testid="next-page" class="page-link disabled">Next &raquo;</span>`;

  const emptyStateHtml =
    groups.length === 0
      ? `<p class="empty-state">No products matched your search.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Storefront Search</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 720px;
    margin: 2rem auto;
    padding: 0 1rem;
    color: #1a1a1a;
    background: #fafafa;
  }
  h1 { font-size: 1.5rem; }
  form.search-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  input[data-testid="search-input"] {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 6px;
  }
  form.search-form button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    border: none;
    border-radius: 6px;
    background: #2563eb;
    color: white;
    cursor: pointer;
  }
  .group {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
  }
  .brand-name { margin: 0 0 0.15rem 0; font-size: 1.2rem; }
  .brand-total { margin: 0 0 0.75rem 0; color: #555; font-size: 0.9rem; }
  ul.items { list-style: none; margin: 0; padding: 0; }
  li.item {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-top: 1px solid #f0f0f0;
  }
  li.item:first-child { border-top: none; }
  .item-name { font-weight: 500; }
  .item-meta { color: #777; font-size: 0.85rem; }
  a.show-more {
    display: inline-block;
    margin-top: 0.6rem;
    font-size: 0.9rem;
    color: #2563eb;
    text-decoration: none;
  }
  a.show-more:hover { text-decoration: underline; }
  nav.pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .page-link { color: #2563eb; text-decoration: none; }
  .page-link.disabled { color: #aaa; pointer-events: none; }
  .empty-state { color: #777; font-style: italic; }
</style>
</head>
<body>
  <h1>Product Search</h1>
  <form class="search-form" method="GET" action="/" data-testid="search-form">
    <input
      type="text"
      name="q"
      value="${escapeHtml(q)}"
      data-testid="search-input"
      placeholder="Search products..."
      autocomplete="off"
    />
    <button type="submit">Search</button>
  </form>

  <div class="groups">
    ${groupsHtml}
    ${emptyStateHtml}
  </div>

  <nav class="pagination">
    ${prevHtml}
    <span data-testid="page-indicator">Page ${page} of ${totalPages}</span>
    ${nextHtml}
  </nav>
</body>
</html>`;
}

module.exports = { renderPage, buildUrl, escapeHtml };
