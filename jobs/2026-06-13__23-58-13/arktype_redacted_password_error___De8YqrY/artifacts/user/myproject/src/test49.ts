import { type } from "arktype"
const ssnType = type(/^\\d{3}-\\d{2}-\\d{4}$/).configure({
    actual: () => "<redacted>",
    problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
})
const schema = type({ ssn: ssnType })
const res = schema({ ssn: "123" })
if (res instanceof type.errors) {
    for (const err of res) {
        if (err.path.length > 0 && ["password", "confirm", "ssn"].includes(String(err.path[0]))) {
            (err as any).data = "<redacted>";
        }
    }
    const outObj = Object.assign({ byPath: res.byPath }, res);
    console.log(JSON.stringify(outObj, (k, v) => k === 'ctx' ? undefined : v));
}
