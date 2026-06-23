import { execSync } from "child_process";
import * as fs from "fs";

interface TestCase {
  name: string;
  payload: any;
  expectedStatus: "VALID" | "INVALID";
}

const testCases: TestCase[] = [
  {
    name: "1. Valid Payload",
    payload: { percent: 25, amount: 99.99, validityDays: 30, appliesTo: "cart" },
    expectedStatus: "VALID",
  },
  {
    name: "2. Percent out of range (100)",
    payload: { percent: 100, amount: 99.99, validityDays: 30, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "3. Percent not divisible by 5 (7)",
    payload: { percent: 7, amount: 99.99, validityDays: 30, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "4. Amount boundary excluded (10000)",
    payload: { percent: 25, amount: 10000, validityDays: 30, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "5. Amount with > 2 decimal places (1.234)",
    payload: { percent: 25, amount: 1.234, validityDays: 30, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "6a. ValidityDays out of range (0)",
    payload: { percent: 25, amount: 99.99, validityDays: 0, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "6b. ValidityDays out of range (366)",
    payload: { percent: 25, amount: 99.99, validityDays: 366, appliesTo: "cart" },
    expectedStatus: "INVALID",
  },
  {
    name: "7. AppliesTo invalid ('other')",
    payload: { percent: 25, amount: 99.99, validityDays: 30, appliesTo: "other" },
    expectedStatus: "INVALID",
  },
];

let failed = false;

for (const tc of testCases) {
  console.log(`Running: ${tc.name}`);
  const inputJson = JSON.stringify(tc.payload);
  
  try {
    const stdout = execSync("npx tsx cli.ts", {
      input: inputJson,
      encoding: "utf-8",
    }).trim();
    
    const lines = stdout.split("\n");
    const statusLine = lines[0];
    
    if (tc.expectedStatus === "VALID") {
      if (statusLine !== "VALID") {
        console.error(`❌ Expected VALID, got: ${statusLine}`);
        failed = true;
      } else {
        console.log(`✅ Success (VALID)`);
        console.log(`   Output: ${lines[1]}`);
      }
    } else {
      if (!statusLine.startsWith("INVALID:")) {
        console.error(`❌ Expected INVALID: ..., got: ${statusLine}`);
        failed = true;
      } else {
        console.log(`✅ Success (${statusLine})`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Command failed with error:`, error.message);
    failed = true;
  }
}

// 8. Verify source file regex requirements
console.log("\nVerifying Source Regex Requirements...");
const sourceCode = fs.readFileSync("src/validator.ts", "utf-8");

// A numeric range expression (e.g. 1 <= ... <= 99)
const rangeRegex = /1\s*<=\s*[\w.]+\s*<=\s*99/;
// A % 5 divisibility constraint
const divisibilityRegex = /%\s*5/;

if (rangeRegex.test(sourceCode)) {
  console.log("✅ Validator source embeds numeric range expression (e.g. 1 <= ... <= 99)");
} else {
  console.error("❌ Validator source does NOT embed numeric range expression matching /1\\s*<=\\s*[\\w.]+\\s*<=\\s*99/");
  failed = true;
}

if (divisibilityRegex.test(sourceCode)) {
  console.log("✅ Validator source embeds % 5 divisibility constraint");
} else {
  console.error("❌ Validator source does NOT embed % 5 divisibility constraint matching /%\\s*5/");
  failed = true;
}

if (failed) {
  console.error("\n❌ SOME TESTS FAILED!");
  process.exit(1);
} else {
  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}
