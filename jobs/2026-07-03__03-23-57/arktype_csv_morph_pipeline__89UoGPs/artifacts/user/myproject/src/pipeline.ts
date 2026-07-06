import { type } from "arktype";

/**
 * ArkType schema for a single user record.
 */
export const recordSchema = type({
  id: "string.uuid",
  age: type("string.integer.parse").to("0 <= number.integer <= 150"),
  email: "string.email",
  signupAt: "string.date.iso.parse"
});

/**
 * End-to-end morph pipeline that parses a raw CSV string into a strongly-typed
 * array of user records, converting 'signupAt' to real Date instances.
 */
export const pipeline = type("string")
  .pipe((rawCsv, ctx) => {
    if (!rawCsv) {
      return ctx.error("a non-empty CSV input");
    }

    const lines = rawCsv.split(/\r?\n/);
    // Strip trailing empty lines (common in text files)
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    if (lines.length === 0) {
      return ctx.error("a CSV with a header row");
    }

    const header = lines[0];
    if (header !== "id,age,email,signupAt") {
      return ctx.error("a CSV starting with header row 'id,age,email,signupAt'");
    }

    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cells = line.split(",");
      if (cells.length !== 4) {
        return ctx.error(`row ${i + 1} to have exactly 4 columns (got ${cells.length})`);
      }
      parsedRows.push({
        id: cells[0],
        age: cells[1],
        email: cells[2],
        signupAt: cells[3]
      });
    }

    return parsedRows;
  })
  .to(recordSchema.array());

export type UserRecord = typeof recordSchema.infer;
export type PipelineOutput = typeof pipeline.infer;
