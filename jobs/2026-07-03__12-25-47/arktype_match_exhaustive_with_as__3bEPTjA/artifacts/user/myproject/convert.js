const { match } = require('arktype');

// Read JSON from STDIN
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  const result = match({
    '"length"': () => `${(data.meters * 3.28084).toFixed(2)} feet`,
    '"mass"': () => `${(data.kilograms * 2.20462).toFixed(2)} pounds`,
    '"temperature"': () => `${((data.celsius * 9/5) + 32).toFixed(2)} Fahrenheit`,
    default: "assert"
  })(data.kind);

  console.log(result);
});
