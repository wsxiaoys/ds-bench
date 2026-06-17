import { pipeline } from "./src/pipeline.js";
import { type } from "arktype";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const result = pipeline(input);

  if (result instanceof type.errors) {
    console.log(`INVALID: ${result.summary.replace(/\n/g, "; ")}`);
  } else {
    console.log("VALID");
    console.log(JSON.stringify(result));
  }
}

main().catch(err => {
  console.log(`INVALID: ${err.message.replace(/\n/g, "; ")}`);
});
