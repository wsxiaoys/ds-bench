import type { RequestHandler } from "@builder.io/qwik-city";
import {
  computeEtag,
  ifNoneMatchHits,
  insertProduct,
  listProducts,
  serializeCatalog,
  validateNewProduct,
  type Product,
} from "~/lib/catalog.server";

type Negotiation = "json" | "html" | "not-acceptable";

function negotiate(acceptHeader: string | null): Negotiation {
  const accept = (acceptHeader ?? "*/*").toLowerCase();
  if (accept.includes("application/json")) {
    return "json";
  }
  if (accept.includes("text/html") || accept.includes("*/*")) {
    return "html";
  }
  return "not-acceptable";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}

function renderCatalogHtml(products: Product[], jsonBody: string): string {
  const items = products
    .map(
      (p) => `        <li data-product-id="${p.id}">
          <span class="name">${escapeHtml(p.name)}</span>
          <span class="price">$${formatPrice(p.priceCents)}</span>
          <span class="stock">${p.stock} in stock</span>
        </li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Qwik Hybrid Catalog</title>
  </head>
  <body>
    <main>
      <h1>Product Catalog</h1>
      <ul id="catalog-list">
${items}
      </ul>
      <script type="application/json" id="catalog-data">${jsonBody}</script>
    </main>
  </body>
</html>
`;
}

export const onGet: RequestHandler = async (requestEvent) => {
  const negotiation = negotiate(requestEvent.request.headers.get("accept"));

  if (negotiation === "not-acceptable") {
    requestEvent.send(new Response(null, { status: 406 }));
    return;
  }

  const products = listProducts();
  const jsonBody = serializeCatalog(products);
  const etag = computeEtag(jsonBody);

  if (negotiation === "json") {
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "Cache-Control": "no-cache",
      Vary: "Accept",
    });

    const ifNoneMatch = requestEvent.request.headers.get("if-none-match");
    if (ifNoneMatchHits(ifNoneMatch, etag)) {
      requestEvent.send(new Response(null, { status: 304, headers }));
      return;
    }

    requestEvent.send(new Response(jsonBody, { status: 200, headers }));
    return;
  }

  // HTML representation - byte-consistent with the JSON representation via
  // the shared `<script type="application/json" id="catalog-data">` block.
  const html = renderCatalogHtml(products, jsonBody);
  requestEvent.send(
    new Response(html, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/html; charset=utf-8",
        Vary: "Accept",
      }),
    }),
  );
};

export const onPost: RequestHandler = async (requestEvent) => {
  let body: unknown;
  try {
    body = await requestEvent.parseBody();
  } catch {
    body = null;
  }

  if (!validateNewProduct(body)) {
    requestEvent.send(
      new Response(JSON.stringify({ error: "Invalid product payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );
    return;
  }

  const created = insertProduct({
    name: body.name.trim(),
    priceCents: body.priceCents,
    stock: body.stock,
  });

  requestEvent.send(
    new Response(JSON.stringify(created), {
      status: 201,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  );
};
