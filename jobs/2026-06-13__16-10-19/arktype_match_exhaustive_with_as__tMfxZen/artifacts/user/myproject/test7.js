const { scope } = require('arktype');

const myScope = scope({
    Length: { kind: "'length'", meters: "number" },
    Mass: { kind: "'mass'", kilograms: "number" },
    Temperature: { kind: "'temperature'", celsius: "number" }
});

console.log(Object.keys(myScope));
