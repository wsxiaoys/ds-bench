const fs = require('fs');
const { scope } = require('arktype');

// Define the schema scope for different conversion kinds
const myScope = scope({
  Length: { kind: '"length"', meters: 'number' },
  Mass: { kind: '"mass"', kilograms: 'number' },
  Temperature: { kind: '"temperature"', celsius: 'number' },
  Volume: { kind: '"volume"', liters: 'number' },
  Input: "Length | Mass | Temperature | Volume"
});

// Build the converter using ArkType's match API
const convert = myScope.match.in("Input")({
  Length: ({ meters }) => `${(meters * 3.28084).toFixed(2)} feet`,
  Mass: ({ kilograms }) => `${(kilograms * 2.20462).toFixed(2)} pounds`,
  Temperature: ({ celsius }) => `${celsius * 1.8 + 32} Fahrenheit`,
})({
  default: "assert"
});

const inputStr = fs.readFileSync(0, 'utf-8').trim();
if (!inputStr) {
  throw new Error("No input received on STDIN");
}

const input = JSON.parse(inputStr);
const result = convert(input);
console.log(result);
