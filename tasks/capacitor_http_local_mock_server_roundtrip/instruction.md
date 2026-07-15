# Capacitor HTTP: Typed API Client Against a Local Mock Server

## Background
Capacitor's `CapacitorHttp` plugin (bundled with `@capacitor/core`) provides native HTTP helpers that work across platforms and, on the web target, are backed by `fetch`. You will wire up a small TypeScript project that enables `CapacitorHttp` in the Capacitor configuration, runs a **local** mock HTTP API, and talks to it through a strongly‑typed API client.

Everything runs locally inside the container. There is no device, emulator, or native build — verification happens purely through the Node CLI. Never call any external/third‑party service; all traffic must stay on `localhost`.

## Requirements
- Enable and configure `CapacitorHttp` in a Capacitor config file.
- Implement a small **mock HTTP API server** that runs on `localhost` and exposes product/order endpoints.
- Implement a **typed API client** built on `CapacitorHttp` that performs GET and POST requests, sends JSON bodies and custom headers, and converts non‑2xx responses into a typed error.
- Provide a CLI "round‑trip" runner that exercises the client end‑to‑end against the running mock server and prints a machine‑readable summary.

## Implementation Hints
- Project path: `/home/user/capacitor-http-app`.
- Node 22 and the packages `@capacitor/core`, `@capacitor/cli`, `typescript`, and `tsx` are already installed in the project; you do **not** have internet access, so rely only on what is present (Node's built‑in `http` module is a fine way to build the mock server).
- The typed client MUST use `CapacitorHttp` imported from `@capacitor/core`. Remember that `CapacitorHttp` does **not** reject on non‑2xx responses — it resolves with the numeric `status` and parsed `data`, so your client is responsible for detecting non‑2xx and raising a typed error whose HTTP status is programmatically accessible.

### Capacitor configuration (`capacitor.config.ts`)
- `appId` must be `com.example.httpdemo`.
- `appName` must be `HttpDemo`.
- `webDir` must be `dist`.
- `CapacitorHttp` must be enabled (`plugins.CapacitorHttp.enabled === true`).

### Mock API server
- Startable with `npm run mock` and listening on `http://localhost:8787`. Bind it so it is reachable via both `http://127.0.0.1:8787` and `http://localhost:8787` (listening without specifying an explicit host is the simplest way).
- It must seed exactly these three products (fields `id`, `name`, `price`): `{ id: 1, name: "Notebook", price: 5 }`, `{ id: 2, name: "Pen", price: 2 }`, `{ id: 3, name: "Backpack", price: 40 }`.
- Endpoints:
  - `GET /api/products` → `200` with a JSON array of the product objects.
  - `GET /api/products/:id` → `200` with the matching product object, or `404` with a JSON body `{ "error": <string> }` when no product has that id.
  - `POST /api/orders` → accepts a JSON body `{ "productId": number, "quantity": number }` and requires the header `X-Api-Key`.
    - Missing or incorrect `X-Api-Key` → `401` with `{ "error": <string> }`.
    - Unknown `productId` → `404` with `{ "error": <string> }`.
    - `quantity` less than 1 → `400` with `{ "error": <string> }`.
    - Otherwise → `201` with `{ "orderId": <non-empty string>, "productId": number, "quantity": number, "total": number }`, where `total` is the product `price` multiplied by `quantity`.
- The accepted API key value is `local-dev-key-123`.

### Round‑trip CLI runner
- Startable with `npm run roundtrip`. It assumes the mock server is already running on `http://localhost:8787` and drives the typed client through this exact scenario:
  1. List all products.
  2. Fetch the product with id `2`.
  3. Create an order for `productId` `3`, `quantity` `2`, using the correct API key.
  4. Attempt to fetch the product with id `999` and capture the HTTP status carried by the resulting typed error.
  5. Attempt to create an order using an **incorrect** API key and capture the HTTP status carried by the resulting typed error.
- After the scenario completes, print exactly one line to stdout that starts with `RESULT: ` followed by a single‑line JSON object containing exactly these keys: `productCount` (number), `product2Name` (string), `orderId` (string), `orderTotal` (number), `missingProductStatus` (number), and `unauthorizedStatus` (number). The process must exit with code `0`.

