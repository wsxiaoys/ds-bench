const fs = require("fs");
const { scope } = require("arktype");

// Define the ArkType scope with the supported conversion schemas
const $ = scope({
  length: { kind: "'length'", meters: "number" },
  mass: { kind: "'mass'", kilograms: "number" },
  temperature: { kind: "'temperature'", celsius: "number" }
});

// Build the exhaustive converter using ArkType's match structure with default: "assert"
const convert = $.match({
  length: ({ meters }) => `${(meters * 3.28).toFixed(2)} feet`,
  mass: ({ kilograms }) => `${(kilograms * 2.20).toFixed(2)} pounds`,
  temperature: ({ celsius }) => `${celsius * 1.8 + 32} Fahrenheit`
})({
  default: "assert"
});

function main() {
  try {
    const input = fs.readFileSync(0, "utf-8");
    if (!input.trim()) {
      console.error("Error: Empty input received");
      process.exit(1);
    }
    const data = JSON.parse(input);
    const result = convert(data);
    console.log(result);
  } catch (err) {
    console.error("Error: " + err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
