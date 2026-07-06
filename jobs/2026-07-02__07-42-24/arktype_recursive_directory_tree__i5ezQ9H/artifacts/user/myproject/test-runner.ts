import { execSync } from "node:child_process"

interface TestCase {
    name: string
    input: string
    expectedStatus: "VALID" | "INVALID"
    expectedContains?: string
}

const testCases: TestCase[] = [
    {
        name: "Valid 4-level nested tree",
        input: JSON.stringify({
            name: "root",
            children: [
                {
                    name: "dir1",
                    children: [
                        {
                            name: "dir2",
                            children: [
                                {
                                    name: "file.txt",
                                    size: 50
                                }
                            ]
                        }
                    ]
                }
            ]
        }),
        expectedStatus: "VALID",
        expectedContains: `"name":"root"`
    },
    {
        name: "Missing name field",
        input: JSON.stringify({
            size: 1024
        }),
        expectedStatus: "INVALID",
        expectedContains: "name must be a string (was missing)"
    },
    {
        name: "File node containing children",
        input: JSON.stringify({
            name: "file.txt",
            size: 1024,
            children: []
        }),
        expectedStatus: "INVALID",
        expectedContains: "children must be undefined"
    },
    {
        name: "Node with name = empty string",
        input: JSON.stringify({
            name: "",
            size: 1024
        }),
        expectedStatus: "INVALID",
        expectedContains: "name must be non-empty"
    },
    {
        name: "Node with non-positive size",
        input: JSON.stringify({
            name: "file.txt",
            size: 0
        }),
        expectedStatus: "INVALID",
        expectedContains: "size must be positive"
    },
    {
        name: "Node with non-integer size",
        input: JSON.stringify({
            name: "file.txt",
            size: 3.5
        }),
        expectedStatus: "INVALID",
        expectedContains: "size must be an integer"
    },
    {
        name: "Malformed JSON input",
        input: "{ malformed json }",
        expectedStatus: "INVALID",
        expectedContains: "Malformed JSON"
    },
    {
        name: "Valid empty directory node",
        input: JSON.stringify({
            name: "empty-dir"
        }),
        expectedStatus: "VALID",
        expectedContains: `"name":"empty-dir"`
    }
]

let passedCount = 0
let failedCount = 0

console.log("Starting test suite...")
console.log("======================")

for (const tc of testCases) {
    try {
        const output = execSync("npx tsx cli.ts", {
            input: tc.input,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
        })

        const lines = output.trim().split("\n")
        const firstLine = lines[0] || ""

        let success = true
        if (tc.expectedStatus === "VALID") {
            if (firstLine !== "VALID") {
                success = false
                console.log(`❌ [FAIL] ${tc.name}: Expected VALID on first line, got: "${firstLine}"`)
            } else if (lines.length < 2) {
                success = false
                console.log(`❌ [FAIL] ${tc.name}: Expected validated JSON on second line, got no second line`)
            } else {
                const secondLine = lines[1]
                try {
                    const parsed = JSON.parse(secondLine)
                    if (tc.expectedContains && !secondLine.includes(tc.expectedContains)) {
                        success = false
                        console.log(`❌ [FAIL] ${tc.name}: Expected JSON to contain "${tc.expectedContains}", but got: ${secondLine}`)
                    }
                } catch (e: any) {
                    success = false
                    console.log(`❌ [FAIL] ${tc.name}: Failed to parse output JSON: ${e.message}`)
                }
            }
        } else {
            if (!firstLine.startsWith("INVALID:")) {
                success = false
                console.log(`❌ [FAIL] ${tc.name}: Expected line starting with "INVALID:", got: "${firstLine}"`)
            } else if (tc.expectedContains && !firstLine.includes(tc.expectedContains)) {
                success = false
                console.log(`❌ [FAIL] ${tc.name}: Expected error to contain "${tc.expectedContains}", but got: "${firstLine}"`)
            }
        }

        if (success) {
            passedCount++
            console.log(`✅ [PASS] ${tc.name}`)
        } else {
            failedCount++
        }
    } catch (err: any) {
        failedCount++
        console.log(`❌ [FAIL] ${tc.name}: Command threw error or exited with non-zero code. Error: ${err.message}`)
    }
}

console.log("======================")
console.log(`Summary: ${passedCount} passed, ${failedCount} failed.`)

if (failedCount > 0) {
    process.exit(1)
} else {
    process.exit(0)
}
