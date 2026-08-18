import type { RequestHandler } from "@builder.io/qwik-city";
import { db, hashKey } from "~/lib/db";

export const onGet: RequestHandler = async (event) => {
  try {
    const apiKey = event.request.headers.get("X-API-Key") || event.headers.get("X-API-Key");

    if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("qk_") || apiKey.length !== 35) {
      event.json(401, { error: "Unauthorized" });
      return;
    }

    const hashed = hashKey(apiKey);

    const stmt = db.prepare("SELECT status FROM api_keys WHERE hashed_key = ?");
    const row = stmt.get(hashed) as { status: string } | undefined;

    if (!row || row.status !== "active") {
      event.json(401, { error: "Unauthorized" });
      return;
    }

    event.json(200, {
      message: "Hello, authenticated developer!",
    });
  } catch (error: any) {
    event.json(500, { error: error?.message || "Internal Server Error" });
  }
};
