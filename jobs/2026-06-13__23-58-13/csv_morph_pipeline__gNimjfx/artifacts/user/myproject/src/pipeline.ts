import { type } from "arktype";

const CsvToArray = type("string").pipe((s, ctx) => {
  const lines = s.split(/\r?\n/).filter(line => line !== "");
  if (lines.length === 0) {
    return ctx.error({ expected: "a non-empty CSV input", actual: "empty input" });
  }
  if (lines[0] !== "id,age,email,signupAt") {
    return ctx.error({ expected: "header 'id,age,email,signupAt'", actual: "malformed header" });
  }
  
  const objects = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const cells = row.split(",");
    if (cells.length !== 4) {
      return ctx.error({ expected: "4 columns", actual: `${cells.length} columns in row ${i}` });
    }
    objects.push({
      id: cells[0],
      age: cells[1],
      email: cells[2],
      signupAt: cells[3]
    });
  }
  return objects;
});

const UserRecord = type({
  id: "string.uuid",
  age: type("string.integer.parse").pipe(type("0<=number<=150")),
  email: "string.email",
  signupAt: "string.date.iso.parse"
});

export const pipeline = CsvToArray.pipe(UserRecord.array());
