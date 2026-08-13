import { component$ } from "@builder.io/qwik";
import { routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import crypto from "crypto";
import { getProducts, addProduct } from "../../catalog.server";

// Loader to fetch products on the server for HTML rendering
export const useCatalogLoader = routeLoader$(() => {
  const products = getProducts();
  return products.map(p => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    stock: p.stock
  }));
});

// Helper to generate strong double-quoted ETags
function generateETag(bodyStr: string): string {
  const hash = crypto.createHash("sha1").update(bodyStr).digest("hex");
  return `"${hash}"`;
}

// GET handler for content negotiation and conditional GET
export const onGet: RequestHandler = async ({ request, headers, status, send, next }) => {
  const accept = request.headers.get("accept") || "";

  const isJson = accept.includes("application/json");
  const isHtml = accept.includes("text/html") || accept.includes("*/*") || !accept || accept.trim() === "";

  if (!isJson && !isHtml) {
    status(406);
    send(406, "Not Acceptable");
    return;
  }

  if (isJson) {
    const products = getProducts();
    const bodyObj = {
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        stock: p.stock
      }))
    };
    const bodyStr = JSON.stringify(bodyObj);
    const etag = generateETag(bodyStr);

    headers.set("ETag", etag);
    headers.set("Cache-Control", "no-cache");
    headers.set("Vary", "Accept");

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      status(304);
      send(304, "");
      return;
    }

    headers.set("Content-Type", "application/json; charset=utf-8");
    send(200, bodyStr);
    return;
  }

  // For HTML representation, set Vary: Accept and proceed to page rendering
  headers.set("Vary", "Accept");
  await next();
};

// POST handler to create a new product
export const onPost: RequestHandler = async ({ request, status, json, send }) => {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    status(400);
    send(400, "Content-Type must be application/json");
    return;
  }

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    status(400);
    send(400, "Invalid JSON body");
    return;
  }

  if (!body || typeof body !== "object") {
    status(400);
    send(400, "Invalid body");
    return;
  }

  const { name, priceCents, stock } = body;

  // Validation
  if (typeof name !== "string" || name.trim() === "") {
    status(400);
    send(400, "Invalid or missing name");
    return;
  }

  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
    status(400);
    send(400, "Invalid or missing priceCents");
    return;
  }

  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
    status(400);
    send(400, "Invalid or missing stock");
    return;
  }

  try {
    const newProduct = addProduct(name.trim(), priceCents, stock);
    status(201);
    json(201, {
      id: newProduct.id,
      name: newProduct.name,
      priceCents: newProduct.priceCents,
      stock: newProduct.stock
    });
  } catch (err) {
    status(500);
    send(500, "Internal Server Error");
  }
};

// Default Component for rendering HTML representation
export default component$(() => {
  const products = useCatalogLoader().value;

  const bodyObj = {
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      stock: p.stock
    }))
  };
  const bodyStr = JSON.stringify(bodyObj);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Product Catalog</h1>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {products.map(p => (
          <li key={p.id} style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
            <strong class="product-name">{p.name}</strong>
            <div style={{ color: "#666" }}>
              Price: ${(p.priceCents / 100).toFixed(2)} | Stock: {p.stock}
            </div>
          </li>
        ))}
      </ul>
      <script
        type="application/json"
        id="catalog-data"
        dangerouslySetInnerHTML={bodyStr}
      />
    </div>
  );
});
