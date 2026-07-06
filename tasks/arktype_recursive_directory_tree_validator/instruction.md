# Recursive Directory Tree Validator (ArkType)

## Goal
Build a TypeScript module at `src/validator.ts` under `/home/user/myproject` that validates a filesystem-style directory tree using `arktype@2.2.0`. Each node has a `name` (non-empty string), an optional `size` (positive integer, present on files only), and an optional `children` array of nested nodes (present on directories only). Only directories may contain children.

You must also implement a CLI wrapper in `cli.ts` (at `/home/user/myproject/cli.ts`) that runs the validator on input received via stdin.

## CLI Requirements
- **Command:** The CLI is invoked via `npx tsx cli.ts`.
- **Input:** It reads a single JSON payload representing one tree node from stdin.
- **Output (stdout):**
  - If the input is valid: print exactly the line `VALID` followed by a newline and the JSON-stringified validated tree on the next line.
  - If the input is invalid/rejected: print exactly one line starting with `INVALID:` followed by a space and any error description.
- **Exit Code:** The CLI must exit with code 0 for both valid and invalid inputs (stdout determines the outcome).

## Test Criteria
1. A valid 4-level nested tree (root -> dir -> dir -> file) MUST validate successfully and return the same structure.
2. A node missing the `name` field MUST be rejected with an ArkType error.
3. A file node (`size` present) containing a `children` array MUST be rejected.
4. A node with `name = ""` MUST be rejected.
5. The implementation MUST export a `validateDirectoryTree(input: unknown)` function from `src/validator.ts` that returns the validated tree or throws. It must use ArkType's `.assert(...)` API so that invalid input throws.
6. The schema MUST be defined via `scope(...).export()` (not a single inline `type(...)`).

## Implementation Hints
- `arktype@2.2.0` and `tsx` are preinstalled.
- `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.
