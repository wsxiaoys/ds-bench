import { TraversalError } from "arktype";
import { route } from "./src/router.js";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

async function main(): Promise<void> {
  const input = await readStdin();
  const data: { events: unknown[] } = JSON.parse(input);

  for (const event of data.events) {
    try {
      const result = route(event);
      console.log(result);
    } catch (err) {
      if (err instanceof TraversalError) {
        console.log(`ERR ${err.message}`);
        break;
      }
      throw err;
    }
  }
}

main();