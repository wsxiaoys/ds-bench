import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function tigrisJSON(args) {
  const stdout = execFileSync("tigris", [...args, "--format", "json"], {
    encoding: "utf8",
  });
  return JSON.parse(stdout);
}

const runId = readFileSync("/logs/artifacts/run-id", "utf8").trim();
const PREFIX = `harbor-inv-${runId}-`
  .toLowerCase()
  .replace(/[^a-z0-9.-]/g, "-");

const bucketsPayload = tigrisJSON(["buckets", "list"]);
const allBuckets = Array.isArray(bucketsPayload)
  ? bucketsPayload
  : (bucketsPayload.items ?? bucketsPayload.buckets ?? []);

const targetNames = allBuckets
  .map((b) => b.name)
  .filter((name) => typeof name === "string" && name.startsWith(PREFIX))
  .sort();

const inventory = {};
let total = 0;

for (const name of targetNames) {
  const snapsPayload = tigrisJSON(["snapshots", "list", name]);
  const snaps = Array.isArray(snapsPayload)
    ? snapsPayload
    : (snapsPayload.items ?? snapsPayload.snapshots ?? []);
  const versions = snaps
    .map((s) => s.version)
    .filter(Boolean)
    .sort();
  inventory[name] = versions;
  total += versions.length;
}

writeFileSync(
  "/home/user/inv/inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);

console.log(`${targetNames.length} buckets, ${total} snapshots`);
