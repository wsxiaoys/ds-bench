import { validateGraph } from "./src/validator.js";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const parsed = JSON.parse(raw);
    const graph = validateGraph(parsed.graph);
    console.log("VALID");
    console.log(JSON.stringify(graph));
  } catch (e: any) {
    console.log(`INVALID: ${e.message ?? e}`);
  }
}

main();