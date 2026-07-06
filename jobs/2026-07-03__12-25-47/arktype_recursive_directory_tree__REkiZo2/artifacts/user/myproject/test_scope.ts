import { scope } from "arktype";

const treeScope = scope({
  node: {
    name: "string > 0",
    size: "number.integer > 0?",
    children: "node[]?"
  }
}).export();

console.log("=== Test 1: 4-level nested tree ===");
const r1 = treeScope.node({
  name: "root",
  children: [
    {
      name: "dir1",
      children: [
        {
          name: "dir2",
          children: [
            { name: "file1", size: 100 }
          ]
        }
      ]
    }
  ]
});
console.log("result:", JSON.stringify(r1, null, 2));
console.log("=== Test 2: missing name ===");
const r2 = treeScope.node({ size: 100 });
console.log("result:", r2 instanceof Error ? r2.message : r2);

console.log("=== Test 3: file with children ===");
const r3 = treeScope.node({ name: "f", size: 100, children: [] });
console.log("result:", r3 instanceof Error ? r3.message : r3);

console.log("=== Test 4: empty name ===");
const r4 = treeScope.node({ name: "" });
console.log("result:", r4 instanceof Error ? r4.message : r4);
