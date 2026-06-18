# Daytona SDK TypeScript Sandbox Example

This project demonstrates how to use the Daytona TypeScript SDK to create a sandbox, execute code, and manage resources.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Daytona API key (set via `DAYTONA_API_KEY` environment variable)
- A Zealt run ID (set via `ZEALT_RUN_ID` environment variable)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set required environment variables:
```bash
export DAYTONA_API_KEY=your_api_key_here
export ZEALT_RUN_ID=your_run_id_here
```

## Usage

Build the TypeScript code:
```bash
npm run build
```

Run the program:
```bash
npm start
```

Or build and run in one step:
```bash
npm run dev
```

## What It Does

1. Creates a Daytona sandbox with TypeScript language support
2. Names the sandbox using the pattern `code-run-ts-{ZEALT_RUN_ID}`
3. Executes a factorial computation (6!) inside the sandbox
4. Captures the result and writes it to `output.log`
5. Cleans up the sandbox by deleting it

## Output

The program will create an `output.log` file containing the factorial result in the format:
```
Factorial: 720
```

## Error Handling

The program includes comprehensive error handling:
- Validates required environment variables
- Checks for non-zero exit codes from code execution
- Ensures sandbox cleanup even on failure paths
- Provides detailed error messages for debugging

## Project Structure

```
myproject/
├── src/
│   └── index.ts          # Main TypeScript program
├── dist/                 # Compiled JavaScript (generated)
├── node_modules/         # Dependencies
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```