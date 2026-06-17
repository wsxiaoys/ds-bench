const { scope } = require('arktype');

const { match } = scope({
    Length: { kind: "'length'", meters: "number" },
    Mass: { kind: "'mass'", kilograms: "number" },
    Temperature: { kind: "'temperature'", celsius: "number" }
});

const convert = match({
    Length: (data) => `${(data.meters * 3.28).toFixed(2)} feet`,
    Mass: (data) => `${(data.kilograms * 2.2).toFixed(2)} pounds`,
    Temperature: (data) => `${(data.celsius * 9/5 + 32)} Fahrenheit`,
    default: "assert"
});

try {
    console.log(convert({ kind: "volume", liters: 1 }));
} catch (e) {
    console.error(e.message);
}
