const { scope } = require('arktype');

const myScope = scope({
    Length: { kind: "'length'", meters: "number" },
    Mass: { kind: "'mass'", kilograms: "number" },
    Temperature: { kind: "'temperature'", celsius: "number" }
});

const convert = myScope.match({
    Length: (data) => `${(data.meters * 3.28).toFixed(2)} feet`,
    Mass: (data) => `${(data.kilograms * 2.2).toFixed(2)} pounds`,
    Temperature: (data) => `${(data.celsius * 9/5 + 32)} Fahrenheit`,
    default: "assert"
});

console.log(convert({ kind: "length", meters: 1 }));
console.log(convert({ kind: "temperature", celsius: 0 }));
