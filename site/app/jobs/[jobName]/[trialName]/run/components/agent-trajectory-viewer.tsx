"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronRight,
	Monitor,
	TerminalIcon,
	User,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpError } from "@/lib/http-error";
import { LogErrorView } from "./trajectory-page";

// ──────────────────────────────────────────────────────────────────────────────
// ATIF-v1.x type definitions
// ──────────────────────────────────────────────────────────────────────────────

type ToolCall = {
	tool_call_id: string;
	function_name: string;
	arguments: Record<string, unknown>;
};

type ObservationResult = {
	content: string;
};

type Observation = {
	results: ObservationResult[];
};

type Metrics = {
	prompt_tokens?: number;
	completion_tokens?: number;
	cached_tokens?: number;
};

type Step = {
	step_id: number;
	timestamp: string;
	source: "user" | "agent";
	model_name?: string;
	message: string;
	reasoning_content?: string;
	tool_calls?: ToolCall[];
	observation?: Observation;
	metrics?: Metrics;
};

type AgentInfo = {
	name?: string;
	version?: string;
	model_name?: string;
};

type AtifTrajectory = {
	schema_version?: string;
	session_id?: string;
	agent?: AgentInfo;
	steps: Step[];
};

// ──────────────────────────────────────────────────────────────────────────────
// Fetch helper
// ──────────────────────────────────────────────────────────────────────────────

async function fetchTrajectory(url: string): Promise<AtifTrajectory> {
	let response: Response;
	try {
		response = await fetch(url, { cache: "force-cache" });
	} catch (_e) {
		throw new HttpError("Network request failed.");
	}

	if (!response.ok) {
		throw new HttpError(`Request failed with status ${response.status}.`, {
			status: response.status,
		});
	}

	const text = await response.text();
	try {
		return JSON.parse(text) as AtifTrajectory;
	} catch (_e) {
		throw new HttpError("Failed to parse trajectory JSON.");
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
	try {
		return new Date(iso).toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return iso;
	}
}

function CommandBlock({ call }: { call: ToolCall }) {
	const [expanded, setExpanded] = useState(false);
	const keystrokes =
		typeof call.arguments.keystrokes === "string"
			? call.arguments.keystrokes
			: null;
	const duration =
		typeof call.arguments.duration === "number"
			? call.arguments.duration
			: null;

	return (
		<div className="rounded-md border border-border/50 bg-muted/20 text-xs">
			<button
				type="button"
				onClick={() => setExpanded((p) => !p)}
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
			>
				<TerminalIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
				<code className="min-w-0 flex-1 truncate font-mono text-foreground/90">
					{keystrokes?.replace(/\n$/, "") ?? call.function_name}
				</code>
				{duration !== null && (
					<span className="shrink-0 text-muted-foreground">{duration}s</span>
				)}
				{expanded ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
			</button>
			{expanded && (
				<div className="border-border/40 border-t px-3 py-2">
					<pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground/80">
						{JSON.stringify(call.arguments, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}

function ObservationBlock({ observation }: { observation: Observation }) {
	const [expanded, setExpanded] = useState(false);
	const firstResult = observation.results[0]?.content ?? "";

	// Show a short preview (first 120 chars) when collapsed
	const preview = firstResult.replace(/\n+/g, " ").slice(0, 120);
	const hasMore = firstResult.length > 120 || observation.results.length > 1;

	return (
		<div className="rounded-md border border-border/40 bg-background/40 text-xs">
			<button
				type="button"
				onClick={() => setExpanded((p) => !p)}
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/20"
			>
				<Monitor className="h-3 w-3 shrink-0 text-cyan-500 dark:text-cyan-400" />
				<span className="min-w-0 flex-1 truncate font-mono text-foreground/70">
					{preview}
					{hasMore && !expanded ? "…" : ""}
				</span>
				{hasMore &&
					(expanded ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					))}
			</button>
			{expanded && (
				<div className="border-border/40 border-t px-3 py-2">
					{observation.results.map((r, i) => (
						<pre
							// biome-ignore lint/suspicious/noArrayIndexKey: index-stable list
							key={i}
							className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground/80"
						>
							{r.content}
						</pre>
					))}
				</div>
			)}
		</div>
	);
}

function ReasoningBlock({ content }: { content: string }) {
	const [expanded, setExpanded] = useState(false);
	const preview = content.replace(/\n+/g, " ").slice(0, 100);

	return (
		<div className="rounded-md border border-border/30 bg-amber-500/5 text-xs">
			<button
				type="button"
				onClick={() => setExpanded((p) => !p)}
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-amber-500/10"
			>
				<span className="shrink-0 text-[11px] leading-none">💭</span>
				<span className="min-w-0 flex-1 truncate text-amber-700 italic dark:text-amber-300">
					Reasoning: {preview}
					{content.length > 100 && !expanded ? "…" : ""}
				</span>
				{expanded ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
			</button>
			{expanded && (
				<div className="border-border/30 border-t px-3 py-2">
					<pre className="whitespace-pre-wrap wrap-break-word font-mono text-[11px] text-amber-800/90 dark:text-amber-200/80">
						{content}
					</pre>
				</div>
			)}
		</div>
	);
}

function MetricsChips({ metrics }: { metrics: Metrics }) {
	const parts: string[] = [];
	if (metrics.prompt_tokens != null)
		parts.push(`↑ ${metrics.prompt_tokens.toLocaleString()}`);
	if (metrics.completion_tokens != null)
		parts.push(`↓ ${metrics.completion_tokens.toLocaleString()}`);
	if (metrics.cached_tokens != null)
		parts.push(`⚡ ${metrics.cached_tokens.toLocaleString()}`);
	if (parts.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5">
			{parts.map((p) => (
				<span
					key={p}
					className="rounded-full border border-border/30 bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
				>
					{p}
				</span>
			))}
		</div>
	);
}

function UserStep({ step, showAvatar }: { step: Step; showAvatar: boolean }) {
	// The first user step is typically the full system prompt — collapse it
	const [expanded, setExpanded] = useState(step.step_id !== 1);
	const isLong = step.message.length > 500;

	return (
		<div className="flex gap-3">
			<div className="flex w-7 shrink-0 flex-col items-center">
				{showAvatar ? (
					<>
						<div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/40">
							<User className="h-3.5 w-3.5 text-muted-foreground" />
						</div>
						<div className="mt-1 w-px flex-1 bg-border/30" />
					</>
				) : (
					<div className="w-px flex-1 bg-border/30" />
				)}
			</div>
			<div className="min-w-0 flex-1 pb-6">
				{!showAvatar && <div className="mt-2 mb-4 h-px w-full bg-border/30" />}
				<div className="mb-1.5 flex items-center gap-2 text-muted-foreground text-xs">
					{showAvatar && (
						<>
							<span className="font-medium text-foreground/70">User</span>
							<span>·</span>
						</>
					)}
					<span>{formatTime(step.timestamp)}</span>
					<span>·</span>
					<span>Step {step.step_id}</span>
				</div>
				<div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
					{isLong && !expanded ? (
						<>
							<p className="whitespace-pre-wrap wrap-break-word text-foreground/80 text-xs leading-5">
								{step.message.slice(0, 500)}…
							</p>
							<button
								type="button"
								onClick={() => setExpanded(true)}
								className="mt-2 cursor-pointer text-[11px] text-primary hover:underline"
							>
								Show full message
							</button>
						</>
					) : (
						<>
							<p className="whitespace-pre-wrap wrap-break-word text-foreground/80 text-xs leading-5">
								{step.message}
							</p>
							{isLong && (
								<button
									type="button"
									onClick={() => setExpanded(false)}
									className="mt-2 cursor-pointer text-[11px] text-primary hover:underline"
								>
									Collapse
								</button>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function AgentStep({ step, showAvatar }: { step: Step; showAvatar: boolean }) {
	const modelLabel = step.model_name?.split("/").pop() ?? "Agent";

	return (
		<div className="flex gap-3">
			<div className="flex w-7 shrink-0 flex-col items-center">
				{showAvatar ? (
					<>
						<div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base leading-none">
							🤖
						</div>
						<div className="mt-1 w-px flex-1 bg-border/30" />
					</>
				) : (
					<div className="w-px flex-1 bg-border/30" />
				)}
			</div>
			<div className="min-w-0 flex-1 pb-6">
				{!showAvatar && <div className="mt-2 mb-4 h-px w-full bg-border/30" />}
				<div className="mb-1.5 flex items-center gap-2 text-muted-foreground text-xs">
					{showAvatar && (
						<>
							<span className="font-medium text-primary/80">{modelLabel}</span>
							<span>·</span>
						</>
					)}
					<span>{formatTime(step.timestamp)}</span>
					<span>·</span>
					<span>Step {step.step_id}</span>
					{step.metrics && (
						<>
							<span>·</span>
							<MetricsChips metrics={step.metrics} />
						</>
					)}
				</div>

				<div className="space-y-2">
					{/* Reasoning (collapsible) */}
					{step.reasoning_content?.trim() && (
						<ReasoningBlock content={step.reasoning_content.trim()} />
					)}

					{/* Main message */}
					{step.message && (
						<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
							<p className="whitespace-pre-wrap wrap-break-word text-foreground/85 text-xs leading-5">
								{step.message}
							</p>
						</div>
					)}

					{/* Tool calls */}
					{step.tool_calls && step.tool_calls.length > 0 && (
						<div className="space-y-1.5">
							{step.tool_calls.map((call) => (
								<CommandBlock key={call.tool_call_id} call={call} />
							))}
						</div>
					)}

					{/* Observation */}
					{step.observation && (
						<ObservationBlock observation={step.observation} />
					)}
				</div>
			</div>
		</div>
	);
}

function TrajectorySkeleton() {
	return (
		<div className="animate-pulse space-y-4 p-4">
			{[...Array(3)].map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
				<div key={i} className="flex gap-3">
					<Skeleton className="h-7 w-7 shrink-0 rounded-full" />
					<div className="flex-1 space-y-2 pt-1">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-16 w-full rounded-lg" />
					</div>
				</div>
			))}
		</div>
	);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main viewer
// ──────────────────────────────────────────────────────────────────────────────

export function AgentTrajectoryViewer({ url }: { url: string }) {
	const query = useQuery({
		queryKey: ["agent-trajectory", url],
		queryFn: () => fetchTrajectory(url),
		retry: 1,
	});

	if (query.isPending || query.isFetching) {
		return <TrajectorySkeleton />;
	}

	if (query.isError) {
		const msg =
			query.error instanceof HttpError
				? query.error.status === 404
					? "Trajectory not found."
					: query.error.message
				: "Failed to load trajectory.";
		return (
			<div className="p-4">
				<LogErrorView message={msg} onRetry={() => void query.refetch()} />
			</div>
		);
	}

	const traj = query.data;
	if (!traj?.steps?.length) {
		return (
			<p className="p-4 text-muted-foreground text-sm">
				No trajectory steps available.
			</p>
		);
	}

	return (
		<ScrollArea className="h-full w-full">
			<div className="mx-auto w-full max-w-full overflow-x-hidden px-4 pt-4 pb-6 sm:px-5 sm:pt-5">
				{/* Header */}
				{traj.agent && (
					<div className="mb-5 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
						{traj.agent.name && (
							<span className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 font-medium">
								{traj.agent.name}
							</span>
						)}
						{traj.agent.model_name && (
							<span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-primary/80">
								{traj.agent.model_name}
							</span>
						)}
						{traj.schema_version && (
							<span className="text-muted-foreground/60">
								{traj.schema_version}
							</span>
						)}
						<span className="ml-auto text-muted-foreground/60">
							{traj.steps.length} steps
						</span>
					</div>
				)}

				{/* Steps */}
				<div>
					{traj.steps.map((step, index) => {
						const showAvatar =
							index === 0 || traj.steps[index - 1].source !== step.source;
						return step.source === "user" ? (
							<UserStep
								key={step.step_id}
								step={step}
								showAvatar={showAvatar}
							/>
						) : (
							<AgentStep
								key={step.step_id}
								step={step}
								showAvatar={showAvatar}
							/>
						);
					})}
				</div>
			</div>
		</ScrollArea>
	);
}
