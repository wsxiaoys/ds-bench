const { match } = require('arktype');

const convert = match({
    "{ kind: '\"length\"', meters: number }": (data) => `${(data.meters * 3.28).toFixed(2)} feet`,
    "{ kind: '\"mass\"', kilograms: number }": (data) => `${(data.kilograms * 2.2).toFixed(2)} pounds`,
    "{ kind: '\"temperature\"', celsius: number }": (data) => `${(data.celsius * 9/5 + 32)} Fahrenheit`,
    default: "assert"
});

console.log(convert({ kind: "length", meters: 1 }));
console.log(convert({ kind: "mass", kilograms: 1 }));
console.log(convert({ kind: "temperature", celsius: 0 }));
