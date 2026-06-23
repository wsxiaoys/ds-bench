# Recursive Directory Tree Validator (ArkType)

## Goal
Build a TypeScript module under `/home/user/myproject` that validates a filesystem-style directory tree using `arktype@2.2.0`. Each node has a `name` (non-empty string), an optional `size` (positive integer, present on files only), and an optional `children` array of nested nodes (present on directories only). Only directories may contain children.

## Test Criteria
1. A valid 4-level nested tree (root -> dir -> dir -> file) MUST validate successfully and return the same structure.
2. A node missing the `name` field MUST be rejected with an ArkType error.
3. A file node (`size` present) containing a `children` array MUST be rejected.
4. A node with `name = ""` MUST be rejected.
5. The implementation MUST export a `validateDirectoryTree(input: unknown)` function that returns the validated tree or throws via `.assert(...)`.
6. The schema MUST be defined via `scope(...).export()` (not a single inline `type(...)`).

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `npx tsx cli.ts`
- Input: a single JSON payload representing one tree node, supplied via stdin.
- Output (stdout):
  - If the input validates: print exactly the line `VALID` followed by a newline and the JSON-stringified validated tree on the next line.
  - If the input is rejected: print exactly one line starting with `INVALID:` followed by a space and any error description.
- The CLI MUST exit with code 0 for both valid and invalid inputs (stdout decides the outcome).
- The TypeScript module file `src/validator.ts` MUST export `validateDirectoryTree(input: unknown)`.
- The schema MUST be constructed via `scope(...).export()` (a single inline `type({...})` definition is not acceptable).
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

