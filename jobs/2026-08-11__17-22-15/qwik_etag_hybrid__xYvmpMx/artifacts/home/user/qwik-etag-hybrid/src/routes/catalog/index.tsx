import { component$ } from "@builder.io/qwik";
import { type RequestHandler, routeLoader$ } from "@builder.io/qwik-city";
import { getProducts, addProduct } from "../../catalog.server";
import { createHash } from "crypto";

export const onGet: RequestHandler = async (event) => {
  const { request, headers, send } = event;
  const accept = request.headers.get("accept") || "";

  if (accept.includes("application/json")) {
    const products = getProducts();
    const bodyObj = { products };
    const jsonBody = JSON.stringify(bodyObj);

    // Generate strong ETag derived from JSON body bytes
    const hash = createHash("sha1").update(jsonBody).digest("hex");
    const etag = `"${hash}"`;

    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("etag", etag);
    headers.set("cache-control", "no-cache");
    headers.set("vary", "Accept");

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      send(304, "");
      return;
    }

    send(200, jsonBody);
    return;
  } else if (accept.includes("text/html") || accept.includes("*/*") || accept === "") {
    // Let Qwik City render the page component
    return;
  } else {
    send(406, "Not Acceptable");
    return;
  }
};

export const onPost: RequestHandler = async (event) => {
  const { request, send, json } = event;
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    send(400, "Invalid JSON");
    return;
  }

  if (!body || typeof body !== "object") {
    send(400, "Invalid request body");
    return;
  }

  const { name, priceCents, stock } = body;

  if (typeof name !== "string" || name.trim() === "") {
    send(400, "Invalid name");
    return;
  }

  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
    send(400, "Invalid priceCents");
    return;
  }

  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
    send(400, "Invalid stock");
    return;
  }

  // Create product
  const newProduct = addProduct({
    name: name.trim(),
    priceCents,
    stock,
  });

  // Success 201
  json(201, newProduct);
};

export const useCatalogLoader = routeLoader$(() => {
  const products = getProducts();
  return { products };
});

export default component$(() => {
  const catalog = useCatalogLoader();
  const jsonBody = JSON.stringify({ products: catalog.value.products });

  return (
    <div>
      <h1>Product Catalog</h1>
      <ul>
        {catalog.value.products.map((product) => (
          <li key={product.id} class="product-item">
            <span class="product-name">{product.name}</span>
            <span class="product-price"> ({product.priceCents}¢)</span>
            <span class="product-stock"> - Stock: {product.stock}</span>
          </li>
        ))}
      </ul>
      <script
        type="application/json"
        id="catalog-data"
        dangerouslySetInnerHTML={jsonBody}
      />
    </div>
  );
});
