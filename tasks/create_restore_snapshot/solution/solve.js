const { Sandbox } = require('e2b');
const fs = require('fs');

async function solve() {
  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create();
  
  console.log("Writing file...");
  await sandbox.files.write('/home/user/checkpoint.txt', 'checkpoint 1');
  
  console.log("Creating snapshot...");
  const snapshot = await sandbox.createSnapshot();
  
  console.log("Writing snapshot ID to /workspace/output.txt:", snapshot.snapshotId);
  fs.writeFileSync('/workspace/output.txt', snapshot.snapshotId);
}

solve().catch(console.error);
