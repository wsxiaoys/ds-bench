# Dotenv-backed Environment Validator (ArkEnv)

## Background
Build a small Node.js CLI under `/home/user/myproject` that uses the `arkenv` library (version `0.12.1`, backed by `arktype@2.2.0`) to load a `.env` file at the project root, merge it with `process.env`, and validate the resulting configuration against a strict schema. The CLI reports the validation outcome on stdout.

## Requirements
The schema MUST validate **all four** of the following variables:

- `PORT`: an integer in the inclusive range `[1024, 65535]`.
- `DATABASE_URL`: a syntactically valid URL string.
- `ALLOWED_ORIGINS`: a comma-separated string parsed into a non-empty array of strings, where **every** element must itself be a valid URL.
- `LOG_LEVEL`: one of the literal values `"debug"`, `"info"`, `"warn"`, or `"error"`.

Any variable that is missing or fails its constraint MUST cause the CLI to report failure.

## Implementation Hints
- The validation logic MUST be driven by `arkenv` (do not call `arktype` directly to define the env schema). Combine `arkenv`'s built-in coercion with ArkType-style schema expressions.
- The CLI MUST load the `.env` file located at `/home/user/myproject/.env` so that the values it defines become available to `arkenv`.
- The CLI entrypoint MUST be `/home/user/myproject/cli.ts`.
- The CLI reads no stdin and accepts no CLI arguments. It is run from `/home/user/myproject` using `npx --no-install tsx cli.ts`.
- Output format requirements on stdout:
  - On validation success, the first non-empty line MUST be exactly `VALID` and the next non-empty line MUST be a JSON object representing the validated env (with `PORT` as a number, `DATABASE_URL` as a string, `ALLOWED_ORIGINS` as an array of strings, and `LOG_LEVEL` as a string).
  - On validation failure, stdout MUST contain exactly one non-empty line that starts with `INVALID:` followed by a space and an error description.
- The process MUST exit with code `0` for both successful and failed validations (stdout decides the outcome). Stderr is ignored by the verifier.
- Dependencies in `/home/user/myproject/package.json` MUST be pinned to `arktype@2.2.0` and `arkenv@0.12.1` in `dependencies`.
- Keep `module` and `moduleResolution` set to `NodeNext` in `/home/user/myproject/tsconfig.json`.

