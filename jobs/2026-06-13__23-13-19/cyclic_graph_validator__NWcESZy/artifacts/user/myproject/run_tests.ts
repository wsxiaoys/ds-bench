import { spawnSync } from "node:child_process";

const testCases = [
  {
    name: "Case 1: Valid 3-node graph with cycle A -> B -> C -> A",
    input: {
      graph: {
        rootId: 1,
        nodes: [
          {
            id: 1,
            label: "A",
            edges: [
              {
                id: 2,
                label: "B",
                edges: [
                  {
                    id: 3,
                    label: "C",
                    edges: [
                      {
                        id: 1,
                        label: "A",
                        edges: []
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 2,
            label: "B",
            edges: [
              {
                id: 3,
                label: "C",
                edges: [
                  {
                    id: 1,
                    label: "A",
                    edges: []
                  }
                ]
              }
            ]
          },
          {
            id: 3,
            label: "C",
            edges: [
              {
                id: 1,
                label: "A",
                edges: []
              }
            ]
          }
        ]
      }
    },
    expectedValid: true
  },
  {
    name: "Case 2: Graph with duplicate node IDs",
    input: {
      graph: {
        rootId: 1,
        nodes: [
          { "id": 1, "label": "A", "edges": [] },
          { "id": 1, "label": "B", "edges": [] }
        ]
      }
    },
    expectedValid: false,
    expectedErrorSubstring: "duplicate node id"
  },
  {
    name: "Case 3: Graph where some edge points to an ID that does not appear in nodes",
    input: {
      graph: {
        rootId: 1,
        nodes: [
          {
            id: 1,
            label: "A",
            edges: [
              { "id": 99, "label": "Missing", "edges": [] }
            ]
          }
        ]
      }
    },
    expectedValid: false,
    expectedErrorSubstring: "edge target id 99 does not exist in nodes"
  },
  {
    name: "Case 4: Graph that contains a node with a negative ID",
    input: {
      graph: {
        rootId: 1,
        nodes: [
          { "id": -1, "label": "A", "edges": [] }
        ]
      }
    },
    expectedValid: false,
    expectedErrorSubstring: "must be non-negative"
  },
  {
    name: "Case 5: Graph with a node whose label has length 41",
    input: {
      graph: {
        rootId: 1,
        nodes: [
          { "id": 1, "label": "12345678901234567890123456789012345678901", "edges": [] }
        ]
      }
    },
    expectedValid: false,
    expectedErrorSubstring: "must be at most length 40"
  },
  {
    name: "Case 6: Graph whose rootId is not present in nodes",
    input: {
      graph: {
        rootId: 4,
        nodes: [
          { "id": 1, "label": "A", "edges": [] }
        ]
      }
    },
    expectedValid: false,
    expectedErrorSubstring: "rootId 4 does not exist in nodes"
  }
];

let failed = false;

for (const tc of testCases) {
  console.log(`Running ${tc.name}...`);
  const child = spawnSync("npx", ["tsx", "cli.ts"], {
    input: JSON.stringify(tc.input),
    encoding: "utf-8"
  });

  if (child.status !== 0) {
    console.error(`  FAIL: Exit code was ${child.status}, expected 0`);
    failed = true;
    continue;
  }

  const lines = child.stdout.trim().split("\n");
  const firstLine = lines[0];

  if (tc.expectedValid) {
    if (firstLine !== "VALID") {
      console.error(`  FAIL: Expected VALID but got: ${firstLine}`);
      console.error(`  Stderr: ${child.stderr}`);
      console.error(`  Stdout: ${child.stdout}`);
      failed = true;
    } else {
      console.log(`  PASS: Validated successfully`);
      try {
        const parsed = JSON.parse(lines[1]);
        if (parsed.rootId !== tc.input.graph.rootId) {
          console.error(`  FAIL: Parsed rootId does not match`);
          failed = true;
        }
      } catch (e: any) {
        console.error(`  FAIL: Could not parse second line as JSON: ${e.message}`);
        failed = true;
      }
    }
  } else {
    if (!firstLine.startsWith("INVALID:")) {
      console.error(`  FAIL: Expected INVALID: ... but got: ${firstLine}`);
      console.error(`  Stderr: ${child.stderr}`);
      console.error(`  Stdout: ${child.stdout}`);
      failed = true;
    } else {
      const errorMsg = firstLine.substring("INVALID:".length).trim();
      const sub = tc.expectedErrorSubstring || "";
      if (!errorMsg.toLowerCase().includes(sub.toLowerCase())) {
        console.error(`  FAIL: Expected error message to contain "${sub}", but got "${errorMsg}"`);
        failed = true;
      } else {
        console.log(`  PASS: Rejected correctly with message: "${errorMsg}"`);
      }
    }
  }
}

if (failed) {
  console.log("\nSome tests FAILED.");
  process.exit(1);
} else {
  console.log("\nAll tests PASSED successfully!");
}
