const { scope } = require("arktype");

const $ = scope({
  Length: { kind: '"length"', meters: "number" },
  Mass: { kind: '"mass"', kilograms: "number" },
  Temp: { kind: '"temperature"', celsius: "number" },
});

const convert = $.match({
  Length: ({ meters }) => `${(meters * 3.28084).toFixed(2)} ft`,
  Mass: ({ kilograms }) => `${(kilograms * 2.20462).toFixed(2)} lbs`,
  Temp: ({ celsius }) => `${(celsius * 9 / 5 + 32)}°F`,
  default: "assert",
});

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const obj = JSON.parse(input.trim());
  const result = convert(obj);
  console.log(result);
});