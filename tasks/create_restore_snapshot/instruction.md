# Task: Sandbox Checkpointing

You are a developer building an AI coding assistant. You want to checkpoint a sandbox after generating some initial project scaffolding so you can restore it later if the AI makes a mistake.

Your task:
1. Use the E2B SDK (Node.js or Python) to create a new sandbox.
2. Inside the sandbox, create a file named `/home/user/checkpoint.txt` with the exact content `checkpoint 1`.
3. Create a snapshot of this sandbox.
4. Write the resulting snapshot ID to `/workspace/output.txt` on the local machine.

Make sure you write *only* the snapshot ID to `/workspace/output.txt` (no extra text or quotes).
