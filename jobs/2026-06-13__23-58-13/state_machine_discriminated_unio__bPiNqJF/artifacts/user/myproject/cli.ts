import { transition, State, Event } from "./src/machine.js";
import { type } from "arktype";

async function run() {
    let input = "";
    for await (const chunk of process.stdin) {
        input += chunk;
    }
    
    let doc;
    try {
        doc = JSON.parse(input);
    } catch (e) {
        console.log("INVALID: Failed to parse JSON");
        process.exit(0);
    }
    
    if (!doc || typeof doc !== "object") {
        console.log("INVALID: document must be an object");
        process.exit(0);
    }
    
    let state = doc.initial;
    
    const s = State(state);
    if (s instanceof type.errors) {
        console.log(`INVALID: ${s.summary}`);
        process.exit(0);
    }
    state = s;
    
    const events = doc.events;
    if (!Array.isArray(events)) {
        console.log("INVALID: events must be an array");
        process.exit(0);
    }
    
    try {
        for (const event of events) {
            state = transition(state, event);
        }
        console.log("VALID");
        console.log(JSON.stringify(state));
    } catch (err: any) {
        console.log(`INVALID: ${err.message}`);
    }
}

run().catch(err => {
    console.log(`INVALID: ${err.message}`);
    process.exit(0);
});
