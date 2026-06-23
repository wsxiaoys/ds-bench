import * as fs from "node:fs";
import { emit } from "./src/emit.js";

function main() {
  try {
    const input = fs.readFileSync(0, "utf-8").trim();
    if (!input) {
      return;
    }
    const parsed = JSON.parse(input);
    const args = parsed.args || [];
    
    try {
      const result = (emit as any)(...args);
      console.log(`OK ${JSON.stringify(result)}`);
    } catch (error: any) {
      console.log(`ERR ${error.message}`);
    }
  } catch (err: any) {
    console.log(`ERR ${err.message}`);
  }
}

main();
