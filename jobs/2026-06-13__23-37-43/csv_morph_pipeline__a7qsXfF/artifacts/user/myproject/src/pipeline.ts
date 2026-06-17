import { type } from "arktype";

// ---------------------------------------------------------------------------
// Step 1: CSV string → raw row objects
//   This morph validates the header, splits rows, checks column counts,
//   and builds an array of plain objects keyed by the expected columns.
// ---------------------------------------------------------------------------
const EXPECTED_HEADER = "id,age,email,signupAt";

const csvToRawRows = type(
  "string",
  "=>",
  (csv, ctx): { id: string; age: string; email: string; signupAt: string }[] => {
    // Split on newlines, keeping \r\n and \n consistent
    const lines = csv.split(/\r?\n/);

    // Filter out trailing empty lines but keep the header at index 0
    const nonEmpty = lines.filter((l, i) => i === 0 || l.trim() !== "");

    if (nonEmpty.length === 0 || nonEmpty[0] === "") {
      return ctx.error("CSV input is empty – expected a header row");
    }

    const header = nonEmpty[0];
    if (header !== EXPECTED_HEADER) {
      return ctx.error(
        `CSV header must be exactly "${EXPECTED_HEADER}" but received "${header}"`
      );
    }

    const dataLines = nonEmpty.slice(1);

    if (dataLines.length === 0) {
      return ctx.error("CSV contains a header but no data rows");
    }

    const rows: { id: string; age: string; email: string; signupAt: string }[] =
      [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const cells = line.split(",");
      if (cells.length !== 4) {
        return ctx.error(
          `Row ${i + 1} has ${cells.length} column(s) but expected 4: "${line}"`
        );
      }
      rows.push({
        id: cells[0],
        age: cells[1],
        email: cells[2],
        signupAt: cells[3],
      });
    }

    return rows;
  }
);

// ---------------------------------------------------------------------------
// Step 2: Validate a single raw row object
//   age arrives as a string; we coerce it to a number via string.integer.parse
//   and then constrain the range.  signupAt is validated as an ISO-8601 string
//   and morphed into a real Date via string.date.iso.parse – the key morph the
//   task requires.
// ---------------------------------------------------------------------------
const userRowType = type({
  id: "string.uuid",
  // string.integer.parse morphs "42" → 42; then we intersect with the range
  age: type("string.integer.parse").pipe(type("0 <= number.integer <= 150")),
  email: "string.email",
  // string.date.iso validates the ISO-8601 format; .parse morphs it into Date
  signupAt: "string.date.iso.parse",
});

// ---------------------------------------------------------------------------
// Step 3: Validate an array of raw rows – pipe each element through userRowType
// ---------------------------------------------------------------------------
const userRowArrayType = type(userRowType.array());

// ---------------------------------------------------------------------------
// Full pipeline: string → UserRecord[]
//   csvToRawRows parses structure; userRowArrayType validates & morphs values.
// ---------------------------------------------------------------------------
export const csvPipeline = csvToRawRows.pipe(userRowArrayType);

// Derive the output type so callers can use it without duplicating the schema.
export type UserRecord = typeof csvPipeline.infer[number];
