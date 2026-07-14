// End-to-end test for the Convex file upload backend.
// 1. generateUploadUrl  2. upload a file  3. saveFile  4. listFiles
import fs from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const deploymentUrl = process.env.CONVEX_URL;
if (!deploymentUrl) {
  console.error("CONVEX_URL not set");
  process.exit(1);
}

const runId = fs.readFileSync("/logs/artifacts/run-id", "utf8").trim();
console.log("Using runId:", runId);

const client = new ConvexHttpClient(deploymentUrl);

// 1. Generate an upload URL.
const uploadUrl = await client.mutation(api.files.generateUploadUrl);
console.log("Got upload URL");

// 2. Upload a small text file to the upload URL.
const content = "Hello from Convex file upload test! runId=" + runId;
const res = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: content,
});
if (!res.ok) {
  console.error("Upload failed:", res.status, await res.text());
  process.exit(1);
}
const uploadResp = await res.json();
const storageId = uploadResp.storageId ?? uploadResp;
console.log("Uploaded file, storageId:", storageId);

// 3. Save the file record.
await client.mutation(api.files.saveFile, {
  storageId,
  title: "test-file.txt",
  runId,
});
console.log("Saved file record");

// 4. List files for this runId.
const files = await client.query(api.files.listFiles, { runId });
console.log("Listed files:", JSON.stringify(files, null, 2));

const found = files.find((f) => f.title === "test-file.txt");
if (!found) {
  console.error("Test file not found in list!");
  process.exit(1);
}
if (!found.url) {
  console.error("File URL missing!");
  process.exit(1);
}
console.log("SUCCESS: file listed with url:", found.url);

// Verify the URL returns the uploaded content.
const dl = await fetch(found.url);
const dlText = await dl.text();
if (dlText !== content) {
  console.error("Downloaded content mismatch:", dlText);
  process.exit(1);
}
console.log("SUCCESS: downloaded content matches uploaded content");
client.close();