import { execSync } from "child_process";

interface TestCase {
    name: string;
    payload: any;
    expectedValid: boolean;
    expectedErrorSubstring?: string;
}

const testCases: TestCase[] = [
    {
        name: "1. Valid payload",
        payload: {
            percent: 25,
            amount: 99.99,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: true
    },
    {
        name: "2. Percent out of range (100)",
        payload: {
            percent: 100,
            amount: 99.99,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "percent"
    },
    {
        name: "3. Percent not divisible by 5 (7)",
        payload: {
            percent: 7,
            amount: 99.99,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "percent"
    },
    {
        name: "4. Amount boundary excluded (10000)",
        payload: {
            percent: 25,
            amount: 10000,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "amount"
    },
    {
        name: "5. Amount more than 2 decimal places (1.234)",
        payload: {
            percent: 25,
            amount: 1.234,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "amount"
    },
    {
        name: "6a. ValidityDays out of range (0)",
        payload: {
            percent: 25,
            amount: 99.99,
            validityDays: 0,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "validityDays"
    },
    {
        name: "6b. ValidityDays out of range (366)",
        payload: {
            percent: 25,
            amount: 99.99,
            validityDays: 366,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "validityDays"
    },
    {
        name: "7. AppliesTo invalid ('other')",
        payload: {
            percent: 25,
            amount: 99.99,
            validityDays: 30,
            appliesTo: "other"
        },
        expectedValid: false,
        expectedErrorSubstring: "appliesTo"
    },
    {
        name: "Extra: Amount equal to 0",
        payload: {
            percent: 25,
            amount: 0,
            validityDays: 30,
            appliesTo: "cart"
        },
        expectedValid: false,
        expectedErrorSubstring: "amount"
    },
    {
        name: "Extra: Extra fields in input",
        payload: {
            percent: 25,
            amount: 99.99,
            validityDays: 30,
            appliesTo: "cart",
            extraField: "hello"
        },
        expectedValid: false,
        expectedErrorSubstring: "extraField"
    }
];

let allPassed = true;

for (const tc of testCases) {
    console.log(`Running test: ${tc.name}`);
    const inputStr = JSON.stringify(tc.payload);
    
    try {
        const stdout = execSync("npx tsx cli.ts", {
            input: inputStr,
            encoding: "utf-8",
            cwd: "/home/user/myproject"
        });

        const lines = stdout.trim().split("\n");
        const firstLine = lines[0];

        if (tc.expectedValid) {
            if (firstLine !== "VALID") {
                console.error(`  FAIL: Expected VALID, got: "${firstLine}"`);
                allPassed = false;
            } else {
                const secondLine = lines[1];
                try {
                    const parsedOutput = JSON.parse(secondLine);
                    if (parsedOutput.percent !== tc.payload.percent || parsedOutput.amount !== tc.payload.amount) {
                        console.error(`  FAIL: Output data mismatch. Got: ${secondLine}`);
                        allPassed = false;
                    } else {
                        console.log(`  PASS: Validated successfully.`);
                    }
                } catch (e: any) {
                    console.error(`  FAIL: Second line is not valid JSON. Got: "${secondLine}"`);
                    allPassed = false;
                }
            }
        } else {
            if (!firstLine.startsWith("INVALID:")) {
                console.error(`  FAIL: Expected line starting with "INVALID:", got: "${firstLine}"`);
                allPassed = false;
            } else {
                if (tc.expectedErrorSubstring && !firstLine.toLowerCase().includes(tc.expectedErrorSubstring.toLowerCase())) {
                    console.error(`  FAIL: Expected error to mention "${tc.expectedErrorSubstring}", got: "${firstLine}"`);
                    allPassed = false;
                } else {
                    console.log(`  PASS: Rejected correctly. Output: "${firstLine}"`);
                }
            }
        }
    } catch (err: any) {
        console.error(`  FAIL: Command threw error or exited with non-zero code:`, err.message);
        allPassed = false;
    }
}

// 8. Source code regex validation
console.log("Running test: 8. Source code regex validation");
import * as fs from "fs";
const sourceCode = fs.readFileSync("/home/user/myproject/src/validator.ts", "utf-8");

const rangeRegex = /1\s*<=\s*.*\s*<=\s*99/;
const divisibilityRegex = /%\s*5/;

const hasRange = rangeRegex.test(sourceCode);
const hasDivisibility = divisibilityRegex.test(sourceCode);

if (!hasRange) {
    console.error("  FAIL: Source code does not contain numeric range expression (e.g. 1 <= ... <= 99)");
    allPassed = false;
} else {
    console.log("  PASS: Source code contains range expression.");
}

if (!hasDivisibility) {
    console.error("  FAIL: Source code does not contain % 5 divisibility constraint");
    allPassed = false;
} else {
    console.log("  PASS: Source code contains divisibility constraint.");
}

if (allPassed) {
    console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉");
    process.exit(0);
} else {
    console.error("\nSOME TESTS FAILED! ❌");
    process.exit(1);
}
