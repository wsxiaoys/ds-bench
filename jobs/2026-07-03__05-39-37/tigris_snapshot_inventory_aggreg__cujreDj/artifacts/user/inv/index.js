import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Run the Tigris CLI with the given arguments, expecting JSON output, and
 * return the parsed JavaScript object.
 *
 * @param {string[]} args - Arguments to pass to the `tigris` CLI.
 * @returns {any} Parsed JSON response.
 */
function tigrisJSON(args) {
  const stdout = execFileSync("tigris", args, { encoding: "utf8" });
  return JSON.parse(stdout);
}

// 1. Read the run id and build the bucket prefix. S3 bucket names may only
//    contain lowercase letters, numbers, dots and hyphens, so normalize the
//    prefix accordingly (lowercase + replace invalid chars with hyphens).
const runId = readFileSync("/logs/artifacts/run-id", "utf8").trim();
const PREFIX = `harbor-inv-${runId}-`
  .toLowerCase()
  .replace(/[^a-z0-9.-]/g, "-");

// 2. List every bucket visible to the current credentials.
const bucketsPayload = tigrisJSON(["buckets", "list", "--format", "json"]);
const allBuckets = Array.isArray(bucketsPayload)
  ? bucketsPayload
  : (bucketsPayload.items ?? bucketsPayload.buckets ?? []);

// 3. Keep only buckets whose name starts with the normalized prefix.
const targetNames = allBuckets
  .map((b) => (typeof b === "string" ? b : b.name))
  .filter((name) => typeof name === "string" && name.startsWith(PREFIX))
  .sort();

// 4-6. For each filtered bucket, collect every snapshot version id, sorted in
//      ascending creation-time order (version ids are UNIX nanosecond
//      timestamps, so ascending order matches oldest-first).
const inventory = {};
let total = 0;
for (const name of targetNames) {
  const snapsPayload = tigrisJSON(["snapshots", "list", name, "--format", "json"]);
  const snaps = snapsPayload.snapshots ?? [];
  const versions = snaps
    .map((s) => s.version)
    .filter((v) => typeof v === "string" && v.length > 0)
    .sort();
  inventory[name] = versions;
  total += versions.length;
}

// 7. Persist the aggregated inventory as pretty-printed JSON.
writeFileSync(
  "/home/user/inv/inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);

// 8. Print the one-line summary.
console.log(`${targetNames.length} buckets, ${total} snapshots`);