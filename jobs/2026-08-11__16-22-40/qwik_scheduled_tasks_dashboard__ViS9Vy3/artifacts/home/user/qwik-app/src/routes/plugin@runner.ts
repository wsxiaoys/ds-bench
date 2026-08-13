import type { RequestHandler } from "@builder.io/qwik-city";
import { startRunner } from "../lib/runner";

export const onRequest: RequestHandler = async () => {
  startRunner();
};
