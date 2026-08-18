import { component$ } from "@builder.io/qwik";
import { type RequestHandler, routeLoader$ } from "@builder.io/qwik-city";
import { createHash } from "crypto";

export const onGet: RequestHandler = async (event) => {
  const accept = event.request.headers.get("accept") || "";
  
  const hasJson = accept.includes("application/json");
  const hasHtml = accept.includes("text/html") || accept.includes("*/*") || accept === "";

  if (hasJson) {
    const { getAllProducts } = await import("../../catalog-db.server");
    const products = getAllProducts();
    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      stock: p.stock,
    }));

    const responseBody = { products: formattedProducts };
    const jsonString = JSON.stringify(responseBody);
    const etag = `"${createHash("sha256").update(jsonString).digest("hex")}"`;

    const ifNoneMatch = event.request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      event.status(304);
      event.headers.set("ETag", etag);
      event.headers.set("Vary", "Accept");
      event.send(304, "");
      return;
    }

    event.status(200);
    event.headers.set("Content-Type", "application/json; charset=utf-8");
    event.headers.set("ETag", etag);
    event.headers.set("Cache-Control", "no-cache");
    event.headers.set("Vary", "Accept");
    event.send(200, jsonString);
    return;
  } else if (hasHtml) {
    event.headers.set("Vary", "Accept");
    event.headers.set("Cache-Control", "no-cache");
    // Fall through to the route loader and page rendering
    return;
  } else {
    event.status(406);
    event.headers.set("Content-Type", "text/plain; charset=utf-8");
    event.send(406, "Not Acceptable");
    return;
  }
};

export const onPost: RequestHandler = async (event) => {
  const contentType = event.request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    event.status(400);
    event.json(400, { error: "Content-Type must be application/json" });
    return;
  }

  let body: any;
  try {
    body = await event.parseBody();
  } catch (err) {
    event.status(400);
    event.json(400, { error: "Invalid JSON body" });
    return;
  }

  if (!body || typeof body !== "object") {
    event.status(400);
    event.json(400, { error: "Invalid body structure" });
    return;
  }

  const { name, priceCents, stock } = body;

  if (typeof name !== "string" || name.trim() === "") {
    event.status(400);
    event.json(400, { error: "name must be a non-empty string" });
    return;
  }

  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
    event.status(400);
    event.json(400, { error: "priceCents must be a non-negative integer" });
    return;
  }

  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
    event.status(400);
    event.json(400, { error: "stock must be a non-negative integer" });
    return;
  }

  const { addProduct } = await import("../../catalog-db.server");
  const newProduct = addProduct({ name, priceCents, stock });

  event.status(201);
  event.json(201, newProduct);
};

export const useCatalogData = routeLoader$(async () => {
  const { getAllProducts } = await import("../../catalog-db.server");
  const products = getAllProducts();
  const formattedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    stock: p.stock,
  }));
  return { products: formattedProducts };
});

export default component$(() => {
  const catalogSignal = useCatalogData();
  const jsonString = JSON.stringify({ products: catalogSignal.value.products });

  return (
    <div class="catalog-container">
      <h1>Product Catalog</h1>
      <ul class="product-list">
        {catalogSignal.value.products.map((p) => (
          <li key={p.id} class="product-item">
            <span class="product-name">{p.name}</span>
            <span class="product-details">
              {" "}
              - ${p.priceCents / 100} ({p.stock} in stock)
            </span>
          </li>
        ))}
      </ul>
      <script
        type="application/json"
        id="catalog-data"
        dangerouslySetInnerHTML={jsonString}
      />
    </div>
  );
});
