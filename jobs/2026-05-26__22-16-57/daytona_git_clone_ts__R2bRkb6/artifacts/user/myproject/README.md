# Daytona Git Repository Cloner

This TypeScript program uses the Daytona SDK to create a sandbox, clone a Git repository, inspect the Git state, and log the results.

## Prerequisites

- Node.js (v18 or higher)
- npm
- A valid Daytona API key set in the `DAYTONA_API_KEY` environment variable
- A run ID set in the `ZEALT_RUN_ID` environment variable

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

## Usage

Set the required environment variables and run the program:

```bash
export DAYTONA_API_KEY="your-api-key"
export ZEALT_RUN_ID="your-run-id"
npm start
```

Or run directly with Node.js:

```bash
export DAYTONA_API_KEY="your-api-key"
export ZEALT_RUN_ID="your-run-id"
node dist/index.js
```

## What It Does

1. Creates a Daytona sandbox named `git-ts-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable
2. Clones the repository `https://github.com/octocat/Spoon-Knife` into `/home/daytona/spoon-knife` inside the sandbox
3. Gets the current branch name using `sandbox.git.status(...)`
4. Lists files using `sandbox.process.executeCommand("ls /home/daytona/spoon-knife")`
5. Writes the branch name and file list to `/home/user/myproject/output.log`
6. Deletes the sandbox before exiting (regardless of success or failure)

## Output

The program creates a log file at `/home/user/myproject/output.log` containing exactly two lines:

- `Branch: <branch_name>` - The current branch name from the cloned repository
- `Files: <comma-separated names>` - All files at the root of the cloned repository, separated by commas

## NPM Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript
- `npm run dev` - Build and run in one command

## Implementation Details

- Uses the `@daytonaio/sdk` package to communicate with the Daytona SaaS at `REDACTED`
- Authenticates using the `DAYTONA_API_KEY` environment variable
- Implements proper error handling with `try/finally` to ensure sandbox cleanup
- Uses the real Daytona service without mocking