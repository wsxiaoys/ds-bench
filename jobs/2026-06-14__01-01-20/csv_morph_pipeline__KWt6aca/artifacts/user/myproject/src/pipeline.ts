import { type, ArkErrors } from "arktype";

// ---------------------------------------------------------------------------
// Record shape – every constraint is validated by ArkType.
//
// `age` is validated as a well-formed integer string and morphed to number
// via `string.integer.parse`, then range-checked with `|>`.
//
// `signupAt` is an ISO-8601 string that is morphed into a real `Date` via
// the built-in `string.date.iso.parse` morph.
// ---------------------------------------------------------------------------
const recordType = type({
  id: "string.uuid",
  age: type("string.integer.parse", "|>", "0 <= number <= 150"),
  email: "string.email",
  signupAt: "string.date.iso.parse",
});

// The array-of-records type used to validate the parsed rows.
const recordsArrayType = recordType.array();

// ---------------------------------------------------------------------------
// Raw record shape (pre-validation, all fields are strings).
// This is the intermediate representation produced by the CSV parser morph.
// ---------------------------------------------------------------------------
interface RawRecord {
  id: string;
  age: string;
  email: string;
  signupAt: string;
}

// ---------------------------------------------------------------------------
// CSV parser morph – takes the raw CSV string and produces an array of
// RawRecord objects.  This is the natural place for the user-defined morph
// that handles splitting lines, checking the header, and counting columns.
// ---------------------------------------------------------------------------
function parseCsv(raw: string): RawRecord[] {
  // Split into lines, preserving trailing empty lines (but we need at least
  // one non-empty line for the header).
  const lines = raw.split("\n");

  // The header must be the first line.  We do NOT trim the raw input, but
  // `split` will give us the exact content of each line (including a possible
  // trailing empty string when the input ends with \n).
  //
  // If the input is empty (no header row at all), reject.
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    throw new Error("CSV is empty: no header row found");
  }

  const header = lines[0];
  if (header !== "id,age,email,signupAt") {
    throw new Error(
      `Invalid CSV header: expected "id,age,email,signupAt", got "${header}"`,
    );
  }

  const rows: RawRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip trailing empty lines (common when CSV ends with \n)
    if (line === "" && i === lines.length - 1) continue;
    if (line === "") continue; // skip blank lines

    const cells = line.split(",");
    if (cells.length !== 4) {
      throw new Error(
        `Row ${i + 1} has ${cells.length} column(s) but expected 4`,
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

// ---------------------------------------------------------------------------
// The end-to-end pipeline composed via `type.pipe`.
//
//   string  ──►  parseCsv  ──►  recordsArrayType
//
// 1. `type.string` validates the input is a string.
// 2. `parseCsv` is a user-defined morph that splits the CSV and checks the
//    header + column counts.
// 3. `recordsArrayType` validates every field of every record, morphing
//    `signupAt` from an ISO-8601 string to a `Date`.
//
// The final inferred output type is a strongly-typed array of user records
// with `signupAt: Date`.
// ---------------------------------------------------------------------------
export const pipeline = type.pipe(
  type.string,
  parseCsv,
  recordsArrayType,
);

// ---------------------------------------------------------------------------
// Convenience helper: run the pipeline and return either the validated array
// or an ArkErrors instance.
// ---------------------------------------------------------------------------
export function run(raw: string) {
  return pipeline(raw);
}

// ---------------------------------------------------------------------------
// Re-export ArkErrors for the CLI.
// ---------------------------------------------------------------------------
export { ArkErrors };
