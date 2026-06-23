import { emit } from "./src/emit.js";

async function main() {
  const stdin = process.stdin;
  let data = "";
  for await (const chunk of stdin) {
    data += chunk;
  }
  
  try {
    if (!data.trim()) return;
    const json = JSON.parse(data.trim());
    const args = json.args || [];
    const result = (emit as any)(...args);
    console.log(`OK ${JSON.stringify(result)}`);
  } catch (err: any) {
    if (err.name === "TraversalError" || err.message) {
      console.log(`ERR ${err.message}`);
    } else {
      console.log(`ERR Unknown error`);
    }
  }
}

main().catch(err => {
  console.log(`ERR ${err.message}`);
});
