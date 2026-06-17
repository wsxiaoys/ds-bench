import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import App from "./App";

// Cart state is stored as a JSON string in the URL search params
// Format: ?cart={"1":2,"3":1} meaning product 1 with qty 2, product 3 with qty 1

const rootRoute = createRootRoute({
  component: App,
  validateSearch: z.object({
    cart: z.string().optional().default(""),
  }),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

export type RouterType = typeof router;