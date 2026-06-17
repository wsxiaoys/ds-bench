import { fetchWithTimeout } from "./src/validator.js";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (e: any) {
    console.log(`ERR Invalid JSON: ${e.message.replace(/\n/g, " ")}`);
    process.exit(0);
  }

  try {
    const result = await fetchWithTimeout(parsed.params);
    console.log(`OK ${JSON.stringify(result)}`);
  } catch (e: any) {
    console.log(`ERR ${e.message.replace(/\n/g, " ")}`);
  }
}

main().catch((e) => {
  console.log(`ERR ${e.message.replace(/\n/g, " ")}`);
  process.exit(0);
});
