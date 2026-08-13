import type { RequestHandler } from "@builder.io/qwik-city";
import db from "~/lib/db";

export const onPost: RequestHandler = async ({ params, json }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    json(400, { error: "Invalid ID parameter" });
    return;
  }

  try {
    const checkStmt = db.prepare("SELECT id FROM api_keys WHERE id = ?");
    const row = checkStmt.get(id);

    if (!row) {
      json(404, { error: "Key not found" });
      return;
    }

    const updateStmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
    updateStmt.run(id);

    json(200, {
      success: true,
      message: `API key with ID ${id} has been successfully revoked.`,
    });
  } catch (error: any) {
    json(500, { error: "Database error: " + error.message });
  }
};
