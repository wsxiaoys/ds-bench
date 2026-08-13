import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import { manifest } from "@qwik-client-manifest";
import render from "./entry.ssr";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

// Create the Qwik City request handler
const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  static: {
    root: distDir,
    cacheControl: "public, max-age=31536000, immutable",
  },
});

const server = createServer((req, res) => {
  staticFile(req, res, () => {
    router(req, res, () => {
      notFound(req, res, () => {});
    });
  });
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}/`);
});
