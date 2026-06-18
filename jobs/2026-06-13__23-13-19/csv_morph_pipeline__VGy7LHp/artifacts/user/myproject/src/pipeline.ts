import { type } from "arktype";

// Define the schema for age, converting string to number and validating range
const ageType = type("string")
  .pipe((s) => {
    if (s.trim() === "") return NaN;
    const num = Number(s);
    return isNaN(num) ? NaN : num;
  })
  .to("0 <= number.integer <= 150");

// Define the schema for signupAt, validating ISO-8601 format and parsing to Date
const signupAtType = type(
  "string.date & /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$/"
)
  .pipe((d) => new Date(d))
  .to("Date");

// Define the individual user record schema
export const RecordSchema = type({
  id: "string.uuid",
  age: ageType,
  email: "string.email",
  signupAt: signupAtType,
});

// The final inferred output type of a single record
export type UserRecord = typeof RecordSchema.infer;

// Define the CSV parsing morph
const csvParser = (csv: string, ctx: any) => {
  if (!csv || csv.trim() === "") {
    ctx.error({ expected: "a CSV string with a header row", actual: "empty input" });
    return [];
  }

  const lines = csv.split(/\r?\n/);

  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length === 0) {
    ctx.error({ expected: "a CSV string with a header row", actual: "empty input" });
    return [];
  }

  const header = lines[0];
  if (header !== "id,age,email,signupAt") {
    ctx.error({ expected: "header row exactly 'id,age,email,signupAt'", actual: header });
    return [];
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(",");
    if (cells.length !== 4) {
      ctx.error({ expected: "exactly 4 comma-separated columns", actual: `${cells.length} columns on row ${i + 1}` });
      return [];
    }
    const [id, age, email, signupAt] = cells;
    records.push({
      id,
      age,
      email,
      signupAt,
    });
  }

  return records;
};

// Define the complete pipeline that morphs a string to UserRecord[]
export const csvPipeline = type("string")
  .pipe(csvParser)
  .to(RecordSchema.array());

// Inferred type of the pipeline output
export type PipelineOutput = typeof csvPipeline.infer;
