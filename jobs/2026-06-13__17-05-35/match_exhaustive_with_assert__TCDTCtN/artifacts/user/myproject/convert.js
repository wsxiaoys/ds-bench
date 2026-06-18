const { match } = require("arktype");

const converter = match.at("kind").strings({
  length: (data) => `${(data.meters * 3.28084).toFixed(2)} feet`,
  mass: (data) => `${(data.kilograms * 2.20462).toFixed(2)} pounds`,
  temperature: (data) => `${(data.celsius * 9 / 5 + 32).toFixed(0)} degrees Fahrenheit`,
  default: "assert",
});

let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const result = converter(data);
    process.stdout.write(result + "\n");
  } catch (err) {
    process.stderr.write(err.message + "\n");
    process.exit(1);
  }
});
