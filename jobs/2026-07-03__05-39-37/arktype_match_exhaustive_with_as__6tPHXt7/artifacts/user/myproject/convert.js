const { readFileSync } = require("fs")

async function main() {
  // arktype is an ESM-only package, so we load it via dynamic import.
  const { match } = await import("arktype")

  // Build the dispatch table using ArkType's `match` API.
  //
  // Each key is an ArkType type definition that discriminates on the `kind`
  // literal. The value is a resolver function that receives the validated
  // input and returns a formatted imperial-unit string.
  //
  // `default: "assert"` guarantees exhaustiveness: any input that does not
  // match one of the declared cases causes the converter to throw.
  const convert = match({
    "{ kind: 'length', meters: number }": ({ meters }) => {
      const feet = meters * 3.28084
      return `${meters} meters = ${feet.toFixed(2)} feet`
    },
    "{ kind: 'mass', kilograms: number }": ({ kilograms }) => {
      const pounds = kilograms * 2.20462
      return `${kilograms} kilograms = ${pounds.toFixed(2)} pounds`
    },
    "{ kind: 'temperature', celsius: number }": ({ celsius }) => {
      const fahrenheit = (celsius * 9) / 5 + 32
      return `${celsius}°C = ${fahrenheit.toFixed(2)}°F`
    },
    default: "assert"
  })

  // Read a single JSON object from STDIN (fd 0).
  const raw = readFileSync(0, "utf-8")
  const input = JSON.parse(raw)

  // Dispatch through the match table. Unmatched inputs throw due to
  // `default: "assert"`.
  const result = convert(input)

  // Print the formatted imperial-unit string to STDOUT.
  console.log(result)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})