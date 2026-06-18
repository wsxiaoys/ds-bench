const { type, match } = require('arktype');

const convert = match.at('kind', {
    "'length'": (data) => `${(data.meters * 3.28).toFixed(2)} feet`,
    "'mass'": (data) => `${(data.kilograms * 2.2).toFixed(2)} pounds`,
    "'temperature'": (data) => `${(data.celsius * 9/5 + 32)} Fahrenheit`,
    default: "assert"
});

console.log(convert({ kind: "length", meters: 1 }));
