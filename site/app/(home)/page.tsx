import { ClipboardList, Github, ListTree, Terminal } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import PendingReviewCard from "@/components/pending-review-card";
import zealtConfig from "@/zealt/config.json";
import pendingTasksData from "@/zealt/pending-tasks.json";
import tasksData from "@/zealt/tasks.json";
import LeaderboardTable, {
	type LeaderboardEntry,
} from "./components/leaderboard-table";

type TaskTrial = {
	agent: string;
	model: string;
	passed: boolean;
	latency_sec: number | null;
};

type TaskValue = {
	trials?: TaskTrial[];
};

type PendingTasksValue = {
	"pending-tasks"?: number;
};

export default function Home() {
	const totalTasks = Object.keys(tasksData as Record<string, unknown>).length;
	const hasTasks = totalTasks > 0;
	const pendingSampleCases = Math.max(
		0,
		Number((pendingTasksData as PendingTasksValue)["pending-tasks"] ?? 0),
	);

	// Process tasks.json to compute leaderboard stats directly on the server
	const statsMap = new Map<
		string,
		{
			passed: number;
			total: number;
			totalLatency: number;
			latencyCount: number;
			model: string;
			rawModel: string;
			agent: string;
		}
	>();

	Object.values(tasksData as Record<string, unknown>).forEach((taskValue) => {
		let trials: TaskTrial[] = [];
		if (Array.isArray(taskValue)) {
			trials = taskValue as TaskTrial[];
		} else if (typeof taskValue === "object" && taskValue !== null) {
			const task = taskValue as TaskValue;
			trials = Array.isArray(task.trials) ? task.trials : [];
		}

		trials.forEach((trial) => {
			// Simplify model name
			const modelName = trial.model.split("/").pop() || trial.model;
			const agentName =
				trial.agent.charAt(0).toUpperCase() + trial.agent.slice(1);

			const key = `${modelName}-${agentName}`;

			if (!statsMap.has(key)) {
				statsMap.set(key, {
					passed: 0,
					total: 0,
					totalLatency: 0,
					latencyCount: 0,
					model: modelName,
					rawModel: trial.model,
					agent: agentName,
				});
			}

			const stats = statsMap.get(key);
			if (!stats) {
				return;
			}
			stats.total += 1;
			if (trial.passed) {
				stats.passed += 1;
			}
			if (trial.latency_sec) {
				stats.totalLatency += trial.latency_sec;
				stats.latencyCount += 1;
			}
		});
	});

	const data: LeaderboardEntry[] = Array.from(statsMap.values())
		.map((stats, index) => {
			const successRate =
				stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
			const avgLatency =
				stats.latencyCount > 0 ? stats.totalLatency / stats.latencyCount : 0;
			return {
				id: String(index + 1),
				model: stats.model,
				rawModel: stats.rawModel,
				agent: stats.agent,
				passedEvals: stats.passed,
				successRate: successRate,
				avgLatency: avgLatency,
			};
		})
		.sort((a, b) => b.successRate - a.successRate);

	// Re-assign IDs based on sorted order and adjust isNew
	data.forEach((item, index) => {
		item.id = String(index + 1);
		item.isNew = index === 0; // Keeping the original visual effect for the top item
	});

	return (
		<div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20">
			{/* Background Gradient Effect */}
			<div className="mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] fixed inset-0 -z-10 h-full w-full bg-[radial-gradient(#2a2a2a_1px,transparent_1px)] bg-background bg-size-[16px_16px] opacity-20 dark:opacity-40"></div>

			<div className="container mx-auto max-w-6xl px-4 py-16">
				{/* Header Section */}
				<div className="mb-16 space-y-2 text-center">
					<div className="mb-4 inline-flex items-center justify-center rounded-full border border-border bg-secondary/50 p-1.5 backdrop-blur-sm">
						<span className="mx-2 flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
						<span className="px-2 font-medium text-xs">Live Benchmarks</span>
					</div>

					<h1 className="bg-linear-to-b from-foreground to-foreground/50 bg-clip-text pb-2 font-bold text-5xl text-transparent tracking-tight md:text-5xl">
						{zealtConfig.title}
					</h1>

					<p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
						{zealtConfig.description}
					</p>

					<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-4 text-muted-foreground text-sm">
						<a
							href={zealtConfig.github_repo}
							target="_blank"
							rel="noopener noreferrer"
							className="flex w-full items-center justify-center gap-2 transition-colors hover:text-primary sm:w-auto"
						>
							<Github className="h-4 w-4" />
							<span>View on GitHub</span>
						</a>
						{data.length > 0 && (
							<>
								<div className="hidden h-4 w-px bg-border sm:block"></div>
								<span className="flex w-full items-center justify-center gap-2 sm:w-auto">
									<ClipboardList className="h-4 w-4" />
									<span># Tasks: {totalTasks}</span>
								</span>
							</>
						)}
						<div className="hidden h-4 w-px bg-border sm:block"></div>
						<span className="flex w-full items-center justify-center gap-2 sm:w-auto">
							<Terminal className="h-4 w-4" />
							<span>Last run: {new Date().toLocaleDateString()}</span>
						</span>
					</div>
				</div>

				{!hasTasks ? (
					<PendingReviewCard pendingSampleCases={pendingSampleCases} />
				) : data.length === 0 ? (
					<div className="rounded-lg border border-border border-dashed bg-card/40 px-8 py-14 text-center backdrop-blur-sm">
						<h2 className="font-semibold text-2xl tracking-tight">
							No evaluation data yet
						</h2>
						<div className="mt-6 flex justify-center">
							<Link
								href="./tasks"
								className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card/50 px-4 py-2 font-medium text-foreground text-sm shadow-sm backdrop-blur-sm transition-colors hover:bg-secondary/50"
							>
								<ListTree className="h-4 w-4" />
								View Tasks
							</Link>
						</div>
					</div>
				) : (
					// Client Component for Interactive Table
					<Suspense
						fallback={
							<div className="py-12 text-center">Loading leaderboard...</div>
						}
					>
						<LeaderboardTable data={data} />
					</Suspense>
				)}
			</div>
		</div>
	);
}
