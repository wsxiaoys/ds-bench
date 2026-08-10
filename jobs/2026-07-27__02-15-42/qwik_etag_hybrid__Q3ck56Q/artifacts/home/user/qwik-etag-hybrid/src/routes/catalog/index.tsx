import { component$ } from "@builder.io/qwik";
import { routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import crypto from "crypto";
import { getAllProducts, createProduct } from "../../data/catalog";

function generateETag(bodyStr: string): string {
  const hash = crypto.createHash("sha1").update(bodyStr, "utf8").digest("hex");
  return `"${hash}"`;
}

export const onGet: RequestHandler = async (ev) => {
  const accept = ev.request.headers.get("accept");
  const acceptHeader = accept ? accept.toLowerCase() : "*/*";

  if (acceptHeader.includes("application/json")) {
    const products = getAllProducts();
    const bodyStr = JSON.stringify({ products });
    const etag = generateETag(bodyStr);

    const ifNoneMatch = ev.request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      ev.status(304);
      ev.headers.set("etag", etag);
      ev.headers.set("vary", "Accept");
      ev.headers.set("cache-control", "no-cache");
      return ev.send(304, "");
    }

    ev.status(200);
    ev.headers.set("content-type", "application/json; charset=utf-8");
    ev.headers.set("etag", etag);
    ev.headers.set("vary", "Accept");
    ev.headers.set("cache-control", "no-cache");
    return ev.send(200, bodyStr);
  } else if (acceptHeader.includes("text/html") || acceptHeader.includes("*/*")) {
    // Let Qwik City proceed to routeLoader$ and default component rendering
    await ev.next();
  } else {
    ev.status(406);
    return ev.send(406, "Not Acceptable");
  }
};

export const onPost: RequestHandler = async (ev) => {
  const contentType = ev.request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    ev.status(400);
    return ev.json(400, { error: "Content-Type must be application/json" });
  }

  let body: any;
  try {
    body = await ev.parseBody();
  } catch (err) {
    ev.status(400);
    return ev.json(400, { error: "Invalid JSON body" });
  }

  if (!body || typeof body !== "object") {
    ev.status(400);
    return ev.json(400, { error: "Invalid JSON body" });
  }

  const { name, priceCents, stock } = body;
  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof priceCents !== "number" ||
    !Number.isInteger(priceCents) ||
    priceCents < 0 ||
    typeof stock !== "number" ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    ev.status(400);
    return ev.json(400, { error: "Invalid product data" });
  }

  const newProduct = createProduct(name.trim(), priceCents, stock);
  ev.status(201);
  return ev.json(201, newProduct);
};

export const useCatalogData = routeLoader$(async () => {
  const products = getAllProducts();
  const jsonString = JSON.stringify({ products });
  return {
    products,
    jsonString,
  };
});

export default component$(() => {
  const data = useCatalogData();

  return (
    <div class="catalog-container">
      <h1>Product Catalog</h1>
      <ul class="product-list">
        {data.value.products.map((product) => (
          <li key={product.id} class="product-item">
            <span class="product-name">{product.name}</span>
            {" - "}
            <span class="product-price">${(product.priceCents / 100).toFixed(2)}</span>
            {" - "}
            <span class="product-stock">({product.stock} in stock)</span>
          </li>
        ))}
      </ul>
      <script
        type="application/json"
        id="catalog-data"
        dangerouslySetInnerHTML={data.value.jsonString}
      />
    </div>
  );
});
