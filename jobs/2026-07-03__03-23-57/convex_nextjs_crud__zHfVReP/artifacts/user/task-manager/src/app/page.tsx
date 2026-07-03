import fs from "fs";
import TaskManager from "./task-manager";

export const dynamic = "force-dynamic";

function getRunId(): string {
  // Try reading from file first, then fallback to env
  try {
    const runIdPath = "/logs/artifacts/run-id";
    if (fs.existsSync(runIdPath)) {
      return fs.readFileSync(runIdPath, "utf8").trim();
    }
  } catch (error) {
    console.error("Failed to read run-id file:", error);
  }

  return process.env.NEXT_PUBLIC_RUN_ID || "unknown";
}

export default function Home() {
  const runId = getRunId();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-lg">
        <TaskManager runId={runId} />
      </div>
    </main>
  );
}
