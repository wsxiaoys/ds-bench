import { type } from "arktype"

const schema = type({
    ssn: type(/^\\d{3}-\\d{2}-\\d{4}$/).configure({
        actual: () => "<redacted>",
        problem: (ctx) => `${ctx.expected} (actual: <redacted>)`
    })
})

const res = schema({ ssn: "123" })
if (res instanceof type.errors) {
    for (const err of res) {
        if (err.path.length > 0 && ["password", "confirm", "ssn"].includes(String(err.path[0]))) {
            (err as any).data = "<redacted>";
        }
    }
    const json = JSON.stringify(res, (key, value) => {
        if (key === "ctx") return undefined;
        return value;
    });
    console.log(json)
}
