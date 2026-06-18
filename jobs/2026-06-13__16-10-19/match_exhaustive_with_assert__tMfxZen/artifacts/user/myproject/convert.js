const fs = require('fs');
const { scope } = require('arktype');

// Read from STDIN
const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) process.exit(0);

const data = JSON.parse(input);

const { match } = scope({
    Length: { kind: "'length'", meters: "number" },
    Mass: { kind: "'mass'", kilograms: "number" },
    Temperature: { kind: "'temperature'", celsius: "number" }
});

const result = match({
    Length: (data) => `${(data.meters * 3.28).toFixed(2)} feet`,
    Mass: (data) => `${(data.kilograms * 2.2).toFixed(2)} pounds`,
    Temperature: (data) => `${(data.celsius * 9/5 + 32)} Fahrenheit`,
    default: "assert"
})(data);

console.log(result);
