import { promises as fs } from "fs";
import path from "path";
import { Daytona } from "@daytonaio/sdk";

const OUTPUT_PATH = path.resolve("/home/user/myproject/output.log");

const ensureEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const factorialSnippet = `const n = 6;
let result = 1;
for (let i = 2; i <= n; i += 1) {
  result *= i;
}
console.log(result);`;

const main = async (): Promise<void> => {
  const runId = ensureEnv("ZEALT_RUN_ID");
  ensureEnv("DAYTONA_API_KEY");

  const daytona = new Daytona();
  let sandbox: Awaited<ReturnType<typeof daytona.create>> | null = null;

  try {
    sandbox = await daytona.create({
      language: "typescript",
      labels: {
        name: `code-run-ts-${runId}`,
      },
    });

    const response = await sandbox.process.codeRun(factorialSnippet);

    if (response.exitCode !== 0) {
      throw new Error(`codeRun failed with exit code ${response.exitCode}`);
    }

    const result = String(response.result ?? "").trim();
    await fs.writeFile(OUTPUT_PATH, `Factorial: ${result}\n`, "utf8");
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
      } catch (error) {
        console.error("Failed to delete sandbox:", error);
        process.exitCode = 1;
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
