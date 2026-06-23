import { type } from "arktype"
const schema = type({ ssn: type(/^\\d{3}-\\d{2}-\\d{4}$/) })
const res = schema({ ssn: "123" })
if (res instanceof type.errors) {
    const outObj = Object.assign({ byPath: res.byPath }, res);
    console.log(JSON.stringify(outObj, (k, v) => k === 'ctx' ? undefined : v));
}
