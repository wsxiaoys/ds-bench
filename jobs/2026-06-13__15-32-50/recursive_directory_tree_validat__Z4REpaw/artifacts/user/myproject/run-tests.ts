import { validateDirectoryTree, types } from "./src/validator.js";
import * as assert from "node:assert";

console.log("Starting test suite...");

// Helper to check if validator throws
function expectThrow(fn: () => void, matchText?: string) {
  try {
    fn();
    assert.fail("Expected function to throw, but it succeeded");
  } catch (err: any) {
    if (matchText) {
      assert.ok(
        err.message.includes(matchText),
        `Expected error message to contain "${matchText}", but got "${err.message}"`
      );
    }
    console.log(`✓ Caught expected error: ${err.message.split("\n")[0]}`);
  }
}

// Case 1: Valid 4-level nested tree (root -> dir -> dir -> file)
console.log("\nTesting Case 1: Valid 4-level nested tree");
const validTree = {
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
              size: 42
            }
          ]
        }
      ]
    }
  ]
};
const validated = validateDirectoryTree(validTree);
assert.deepStrictEqual(validated, validTree);
console.log("✓ Valid 4-level nested tree validated successfully");

// Case 2: A node missing the `name` field MUST be rejected with an ArkType error
console.log("\nTesting Case 2: Missing name field");
const missingName = {
  children: [
    {
      name: "file.txt",
      size: 42
    }
  ]
};
expectThrow(() => validateDirectoryTree(missingName), "name");

// Case 3: A file node (size present) containing a children array MUST be rejected
console.log("\nTesting Case 3: File node containing children");
const fileWithChildren = {
  name: "invalid-file.txt",
  size: 100,
  children: []
};
expectThrow(() => validateDirectoryTree(fileWithChildren), "children must be undefined");

// Case 4: A node with name = "" MUST be rejected
console.log("\nTesting Case 4: Empty name string");
const emptyName = {
  name: "",
  size: 100
};
expectThrow(() => validateDirectoryTree(emptyName), "name");

// Case 5: The implementation MUST export a validateDirectoryTree function
console.log("\nTesting Case 5: Exporting validateDirectoryTree");
assert.strictEqual(typeof validateDirectoryTree, "function");
console.log("✓ validateDirectoryTree is exported and is a function");

// Case 6: Schema defined via scope(...).export()
console.log("\nTesting Case 6: Schema defined via scope(...).export()");
assert.ok(types.node, "types.node should exist");
assert.ok(types.file, "types.file should exist");
assert.ok(types.directory, "types.directory should exist");
console.log("✓ Schema is defined via scope and exported successfully");

// Extra Check: Invalid size type (negative, zero, float)
console.log("\nTesting Extra: Invalid size values");
expectThrow(() => validateDirectoryTree({ name: "f", size: 0 }), "size");
expectThrow(() => validateDirectoryTree({ name: "f", size: -1 }), "size");
expectThrow(() => validateDirectoryTree({ name: "f", size: 1.5 }), "size");

console.log("\nAll tests passed successfully! 🎉");
