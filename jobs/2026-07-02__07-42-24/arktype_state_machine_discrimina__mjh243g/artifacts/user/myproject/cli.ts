import * as fs from "node:fs";
import { type } from "arktype";
import { State, Event, transition } from "./src/types.js";

function main() {
  let inputStr = "";
  try {
    inputStr = fs.readFileSync(0, "utf-8");
  } catch (err: any) {
    console.log(`INVALID: Failed to read from stdin: ${err.message}`);
    process.exit(0);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(inputStr);
  } catch (err: any) {
    console.log(`INVALID: Failed to parse input JSON: ${err.message}`);
    process.exit(0);
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.log("INVALID: Input must be a JSON object");
    process.exit(0);
  }

  const { initial, events } = parsed;

  const initialResult = State(initial);
  if (initialResult instanceof type.errors) {
    console.log(`INVALID: Invalid initial state: ${initialResult.summary}`);
    process.exit(0);
  }

  if (!Array.isArray(events)) {
    console.log("INVALID: 'events' must be an array");
    process.exit(0);
  }

  let currentState = initialResult;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      currentState = transition(currentState, event);
    } catch (err: any) {
      console.log(`INVALID: Event at index ${i} or transition failed: ${err.message || err}`);
      process.exit(0);
    }
  }

  console.log("VALID");
  console.log(JSON.stringify(currentState));
}

main();
