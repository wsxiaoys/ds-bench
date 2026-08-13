import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";

export const onPost: RequestHandler = async (event) => {
  try {
    const idStr = event.params.id;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      event.json(400, { error: "Invalid key ID" });
      return;
    }

    // Check if the key exists
    const checkStmt = db.prepare("SELECT id FROM api_keys WHERE id = ?");
    const keyExists = checkStmt.get(id);

    if (!keyExists) {
      event.json(404, { error: "Key not found" });
      return;
    }

    // Update the status to 'revoked'
    const updateStmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
    updateStmt.run(id);

    event.json(200, {
      success: true,
      message: "API key has been successfully revoked",
    });
  } catch (error: any) {
    event.json(500, { error: error?.message || "Internal Server Error" });
  }
};
