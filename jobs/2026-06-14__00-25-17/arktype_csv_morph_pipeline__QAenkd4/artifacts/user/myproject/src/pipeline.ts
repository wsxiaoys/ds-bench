import { type } from "arktype";

/**
 * Validates a single user record with morphs for age (string → integer) and signupAt (string → Date).
 */
export const UserRecord = type({
  id: "string.uuid",
  age: "string.integer.parse |> 0 <= number <= 150",
  email: "string.email",
  signupAt: "string.date.iso.parse",
});

/**
 * End-to-end CSV pipeline:
 *   string → parse CSV → validate each record via UserRecord
 *
 * The first morph splits the raw input, checks the header, and produces
 * an array of raw string-typed record objects. The second step validates
 * every record through UserRecord (which includes the morphs above).
 */
export const CsvPipeline = type("string").pipe(
  (raw: string) => {
    const lines = raw.split(/\r?\n/);
    const dataLines = lines.filter((line) => line.length > 0);

    if (dataLines.length === 0) {
      throw new Error("Input is empty: no header row");
    }

    const header = dataLines[0];
    if (header !== "id,age,email,signupAt") {
      throw new Error(
        `Invalid header: expected "id,age,email,signupAt", got "${header}"`,
      );
    }

    const records: {
      id: string;
      age: string;
      email: string;
      signupAt: string;
    }[] = [];

    for (let i = 1; i < dataLines.length; i++) {
      const cells = dataLines[i].split(",");
      if (cells.length !== 4) {
        throw new Error(
          `Row ${i} has ${cells.length} columns, expected 4`,
        );
      }
      records.push({
        id: cells[0],
        age: cells[1],
        email: cells[2],
        signupAt: cells[3],
      });
    }

    return records;
  },
  UserRecord.array(),
);

/** Inferred output type: Array<{ id: string, age: number, email: string, signupAt: Date }> */
export type UserRecordOutput = typeof CsvPipeline.infer;