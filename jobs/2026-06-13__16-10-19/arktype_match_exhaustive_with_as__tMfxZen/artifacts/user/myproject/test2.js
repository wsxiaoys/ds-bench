const { type, match } = require('arktype');

const convert = match({
    "number": (n) => n,
    "string": (s) => s.length,
    default: "assert"
});

console.log(convert(5));
