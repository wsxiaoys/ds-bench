import { match } from "arktype";

const handleResponse = match
  .at("status")
  .match({
    "'success'": (o: { data: object }) => `OK:${JSON.stringify(o.data)}`,
    "'error'": (o: { code: number; reason: string }) =>
      `ERR ${o.code} ${o.reason}`,
    "'pending'": () => "PENDING",
    default: "assert",
  });

// Read a single JSON object from stdin and write the formatted result to stdout
async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

  try {
    const result = handleResponse(input);
    process.stdout.write(`${result}\n`);
  } catch (err) {
    process.exit(1);
  }
}

main();
