import { type } from "arktype";

export const State = type({ status: "'idle'" })
    .or({ status: "'loading'", startedAt: "number.integer >= 0" })
    .or({ status: "'success'", data: "unknown", fetchedAt: "number.integer >= 0" })
    .or({ status: "'failure'", code: "number.integer >= 400 <= 599", reason: "string >= 1 <= 200" });

export const Event = type({ type: "'start'", at: "number" })
    .or({ type: "'resolve'", data: "unknown", at: "number" })
    .or({ type: "'reject'", code: "number.integer", reason: "string", at: "number" })
    .or({ type: "'reset'" });

export function transition(state: unknown, event: unknown): unknown {
    const s = State(state);
    if (s instanceof type.errors) {
        throw new Error(s.summary);
    }
    const e = Event(event);
    if (e instanceof type.errors) {
        throw new Error(e.summary);
    }
    
    let result: unknown = s;
    
    if (s.status === "idle" && e.type === "start") {
        result = {
            status: "loading",
            startedAt: Math.trunc(e.at)
        };
    } else if (s.status === "loading" && e.type === "resolve") {
        result = {
            status: "success",
            data: e.data,
            fetchedAt: Math.trunc(e.at)
        };
    } else if (s.status === "loading" && e.type === "reject") {
        result = {
            status: "failure",
            code: e.code,
            reason: e.reason
        };
    } else if (e.type === "reset") {
        result = {
            status: "idle"
        };
    }
    
    const out = State(result);
    if (out instanceof type.errors) {
        throw new Error(out.summary);
    }
    return out;
}
