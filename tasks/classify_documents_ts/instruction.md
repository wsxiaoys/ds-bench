# Classify Documents with LlamaCloud (TypeScript SDK)

## Background
LlamaCloud's Classify product categorizes documents into developer-defined types using natural-language rules. The platform is exposed through the `@llamaindex/llama-cloud` TypeScript SDK (v2.x), which is a Stainless-generated client that mirrors the Python SDK. In this task you will write a small Node.js / TypeScript program that uploads several sample files to LlamaCloud, runs a single Classify job over them with custom rules, and reports the resulting categories.

Your project directory `/home/user/myproject` already contains three sample text documents in `samples/`:
- `samples/invoice.txt` — a synthetic commercial invoice with invoice number, bill-to section, line items, and totals.
- `samples/receipt.txt` — a short point-of-sale receipt.
- `samples/contract.txt` — a short legal services agreement with signatures.

A `LLAMA_CLOUD_API_KEY` environment variable is configured for you, and the network can reach the LlamaCloud production endpoint.

## Requirements
- Write a TypeScript program in `/home/user/myproject/classify.ts` that:
  1. Uploads each of the three sample files to LlamaCloud with `purpose="classify"`.
  2. Submits a single Classify job through the SDK's convenience helper that uses three custom rules with the types `invoice`, `receipt`, and `contract`.
  3. Runs the job in `FAST` mode.
  4. Writes the predicted category and confidence for every sample file to a log artifact.
- Use only the `@llamaindex/llama-cloud` package to talk to LlamaCloud. Do **NOT** use the legacy `llama-cloud-services` wrapper or the v1 LlamaParse Python package.
- The program must be runnable end-to-end with `npx tsx classify.ts`.

## Implementation Hints
- Import the default export from `@llamaindex/llama-cloud` and instantiate it with no arguments to pick up `LLAMA_CLOUD_API_KEY` from the environment.
- The Classify resource lives under `client.classifier`. The convenience `client.classifier.classify({...})` call handles upload → poll → result. Each rule is an object with `type` and `description`.
- File uploads in Node.js use `fs.createReadStream` with `client.files.create({ file, purpose })`. The returned object has an `id` property.
- The classify result exposes an `items` array; each item has `file_id` plus a `result` object with `type`, `confidence`, and `reasoning`. The order of `items` follows the order of `file_ids` you submit.
- Read the parallel-run id from the `ZEALT_RUN_ID` environment variable and write it as the very first line of the log file so concurrent runs do not clobber each other's expectations.
- The Classify product is in beta; use only fields and methods documented for the v2 SDK.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is executed against the real LlamaCloud API and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The log file must contain, in order:
  1. A first line in the exact format `Run ID: <run-id>` where `<run-id>` is the value of the `ZEALT_RUN_ID` environment variable.
  2. One line per sample file in the exact format `Classified: <basename> | Type: <type> | Confidence: <confidence>` where `<basename>` is the file name without any directory prefix (e.g., `invoice.txt`), `<type>` is the predicted category string returned by Classify, and `<confidence>` is the numeric confidence value as returned by Classify.
- The file `/home/user/myproject/classify.ts` must exist and must import from `@llamaindex/llama-cloud`.
- The classification of `invoice.txt` must be `invoice`, of `receipt.txt` must be `receipt`, and of `contract.txt` must be `contract`.

