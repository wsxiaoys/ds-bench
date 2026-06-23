import * as fs from "fs";
import { csvPipeline } from "./src/pipeline.js";
import { ArkErrors } from "arktype";

function main() {
  try {
    const input = fs.readFileSync(0, "utf-8");
    const result = csvPipeline(input);

    if (result instanceof ArkErrors) {
      console.log(`INVALID: ${result.summary}`);
    } else {
      console.log("VALID");
      console.log(JSON.stringify(result));
    }
  } catch (err: any) {
    console.log(`INVALID: ${err.message || err}`);
  }
}

main();
