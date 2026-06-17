"use client";

import { type ClassValue, clsx } from "clsx";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Check,
	ExternalLink,
	Filter,
	Search,
	X,
	X as XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { twMerge } from "tailwind-merge";
import { BackToLeaderboard } from "@/components/back-to-leaderboard";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import zealtConfig from "@/zealt/config.json";
import { BackToTop } from "./back-to-top";
import { MultiSelect } from "./multi-select";

export type CompactTrial = {
	job_name: string;
	trial_name: string;
	trajectory_id?: string;
	model: string;
	rawModel: string;
	agent: string;
	passed: boolean;
	reward: number | null;
	error: boolean;
	latency_sec: number | null;
	latency_breakdown: {
		env_setup: number | null;
		agent_setup: number | null;
		agent_exec: number | null;
		verifier: number | null;
	};
	taskName: string;
	exec_duration: number;
};

export type CompactTask = {
	taskName: string;
	instruction: string;
	trials: CompactTrial[];
};

type TasksPageClientProps = {
	tasksData: CompactTask[];
};

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(query);
		setMatches(media.matches);

		const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
		media.addEventListener("change", listener);

		return () => media.removeEventListener("change", listener);
	}, [query]);

	return matches;
}

type TableWrapperProps = {
	hasRows: boolean;
	children: ReactNode;
};

function TableWrapper({ hasRows, children }: TableWrapperProps) {
	if (!hasRows) {
		return (
			<div className="flex flex-1 items-center justify-center py-12 text-center text-muted-foreground">
				No tasks found matching your filters
			</div>
		);
	}

	return (
		<div className="custom-scrollbar relative overflow-auto">{children}</div>
	);
}

export function TasksPageClient({ tasksData }: TasksPageClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [queryQ, setQueryQ] = useState("");
	const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
	const [selectedModels, setSelectedModels] = useState<string[]>([]);
	const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
	const [querySort, setQuerySort] = useState("default");
	const [queryOrder, setQueryOrder] = useState("asc");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTask, setSelectedTask] = useState<string | null>(null);
	const [isInstructionOpen, setIsInstructionOpen] = useState(false);
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const [devMode, setDevMode] = useState(
		process.env.NODE_ENV === "development",
	);

	const hasActiveFilters =
		selectedStatuses.length > 0 ||
		selectedModels.length > 0 ||
		selectedAgents.length > 0 ||
		searchQuery !== "" ||
		querySort !== "default";

	const updateParams = useCallback(
		(updates: {
			q?: string;
			status?: string[];
			model?: string[];
			agent?: string[];
			sort?: string;
			order?: string;
		}) => {
			const nextQ = updates.q ?? queryQ;
			const nextStatuses = updates.status ?? selectedStatuses;
			const nextModels = updates.model ?? selectedModels;
			const nextAgents = updates.agent ?? selectedAgents;
			const nextSort = updates.sort ?? querySort;
			const nextOrder = updates.order ?? queryOrder;

			const params = new URLSearchParams();

			if (nextQ) {
				params.set("q", nextQ);
			}
			if (nextStatuses.length > 0) {
				params.set("status", nextStatuses.join(","));
			}
			if (nextModels.length > 0) {
				params.set("model", nextModels.join(","));
			}
			if (nextAgents.length > 0) {
				params.set("agent", nextAgents.join(","));
			}
			if (nextSort !== "default") {
				params.set("sort", nextSort);
			}
			if (nextSort !== "default" && nextOrder !== "asc") {
				params.set("order", nextOrder);
			}

			const nextUrl = params.toString()
				? `${pathname}?${params.toString()}`
				: pathname;
			router.replace(nextUrl, { scroll: false });
		},
		[
			pathname,
			queryOrder,
			queryQ,
			querySort,
			router,
			selectedAgents,
			selectedModels,
			selectedStatuses,
		],
	);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);

		const initialQ = params.get("q") || "";
		const initialStatuses = (params.get("status") || "")
			.split(",")
			.filter(Boolean);
		const initialModels = (params.get("model") || "")
			.split(",")
			.filter(Boolean);
		const initialAgents = (params.get("agent") || "")
			.split(",")
			.filter(Boolean);
		const initialSort = params.get("sort") || "default";
		const initialOrder = params.get("order") || "asc";
		const initialDevMode =
			process.env.NODE_ENV === "development" ||
			localStorage.getItem("devMode") === "true";

		setQueryQ(initialQ);
		setSearchQuery(initialQ);
		setSelectedStatuses(initialStatuses);
		setSelectedModels(initialModels);
		setSelectedAgents(initialAgents);
		setQuerySort(initialSort);
		setQueryOrder(initialOrder);
		setDevMode(initialDevMode);
	}, []);

	useEffect(() => {
		if (searchQuery === queryQ) {
			return;
		}

		const timer = setTimeout(() => {
			setQueryQ(searchQuery);
			updateParams({ q: searchQuery });
		}, 300);
		return () => clearTimeout(timer);
	}, [queryQ, searchQuery, updateParams]);

	const allTrialsFlat = useMemo(
		() =>
			tasksData.flatMap((task) =>
				task.trials
					.filter((trial) => {
						const config = zealtConfig as { pending_models?: string[] };
						if (
							!devMode &&
							config.pending_models &&
							config.pending_models.length > 0
						) {
							return !config.pending_models.includes(trial.rawModel);
						}
						return true;
					})
					.map((trial) => ({
						...trial,
					})),
			),
		[tasksData, devMode],
	);

	const allModels = useMemo(
		() => Array.from(new Set(allTrialsFlat.map((tr) => tr.model))),
		[allTrialsFlat],
	);

	const allCombos = useMemo(
		() =>
			Array.from(
				new Set(allTrialsFlat.map((tr) => `${tr.model} (${tr.agent})`)),
			).sort(),
		[allTrialsFlat],
	);

	const activeCombos = useMemo(() => {
		const combos = allCombos.filter((combo) => {
			const [model, agentStr] = combo.split(" (");
			const agent = agentStr.slice(0, -1);

			if (selectedModels.length !== 1) {
				if (selectedModels.length > 0 && !selectedModels.includes(model))
					return false;
			}

			if (
				selectedAgents.length > 0 &&
				!selectedAgents.includes(agent.toLowerCase())
			)
				return false;
			return true;
		});

		if (selectedModels.length === 1) {
			const selectedModel = selectedModels[0];
			combos.sort((a, b) => {
				const aModel = a.split(" (")[0];
				const bModel = b.split(" (")[0];
				const aIsSelected = aModel === selectedModel;
				const bIsSelected = bModel === selectedModel;
				if (aIsSelected && !bIsSelected) return -1;
				if (!aIsSelected && bIsSelected) return 1;
				return a.localeCompare(b);
			});
		}

		return combos;
	}, [
		allCombos,
		selectedModels.includes,
		selectedModels.length,
		selectedAgents.includes,
		selectedModels[0],
		selectedAgents.length,
	]);

	const noTrials = activeCombos.length === 0;

	const tableTasks = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();

		if (noTrials) {
			const filtered = query
				? tasksData.filter((task) =>
						task.taskName.toLowerCase().includes(query),
					)
				: tasksData;

			return [...filtered]
				.map((task) => ({
					taskName: task.taskName,
					comboMap: {} as Record<string, CompactTrial>,
					avgDuration: 0,
				}))
				.sort((a, b) =>
					queryOrder === "desc"
						? b.taskName.localeCompare(a.taskName)
						: a.taskName.localeCompare(b.taskName),
				);
		}

		const result = tasksData
			.map((task) => {
				const comboMap: Record<string, CompactTrial> = {};
				let hasMatchingTrial = false;
				let selectedModelMatchesStatus = false;
				let hasSelectedModelTrial = false;

				task.trials.forEach((trial) => {
					const comboKey = `${trial.model} (${trial.agent})`;
					if (!activeCombos.includes(comboKey)) return;

					let matchesStatus = true;
					if (selectedStatuses.length > 0) {
						if (selectedStatuses.includes("passed") && trial.passed) {
							matchesStatus = true;
						} else if (
							selectedStatuses.includes("failed") &&
							!trial.passed &&
							!trial.error
						) {
							matchesStatus = true;
						} else if (selectedStatuses.includes("error") && trial.error) {
							matchesStatus = true;
						} else {
							matchesStatus = false;
						}
					}

					if (
						selectedModels.length === 1 &&
						trial.model === selectedModels[0]
					) {
						hasSelectedModelTrial = true;
						if (matchesStatus) {
							selectedModelMatchesStatus = true;
						}
					}

					if (selectedModels.length === 1) {
						comboMap[comboKey] = trial;
					} else if (matchesStatus) {
						comboMap[comboKey] = trial;
						hasMatchingTrial = true;
					}
				});

				if (selectedModels.length === 1) {
					if (selectedStatuses.length > 0) {
						hasMatchingTrial = selectedModelMatchesStatus;
					} else {
						hasMatchingTrial = hasSelectedModelTrial;
					}
				}

				const comboTrials = Object.values(comboMap);
				const avgDuration =
					comboTrials.length > 0
						? comboTrials.reduce((sum, t) => sum + t.exec_duration, 0) /
							comboTrials.length
						: 0;

				return {
					taskName: task.taskName,
					comboMap,
					hasMatchingTrial,
					avgDuration,
				};
			})
			.filter((task) => {
				if (!task.hasMatchingTrial) return false;
				if (query && !task.taskName.toLowerCase().includes(query)) return false;
				return true;
			});

		result.sort((a, b) => {
			if (querySort === "latency") {
				return queryOrder === "asc"
					? a.avgDuration - b.avgDuration
					: b.avgDuration - a.avgDuration;
			}

			return queryOrder === "asc"
				? a.taskName.localeCompare(b.taskName)
				: b.taskName.localeCompare(a.taskName);
		});

		return result.map(({ taskName, comboMap, avgDuration }) => ({
			taskName,
			comboMap,
			avgDuration,
		}));
	}, [
		activeCombos,
		noTrials,
		queryOrder,
		querySort,
		searchQuery,
		tasksData,
		selectedStatuses.length,
		selectedStatuses.includes,
		selectedModels[0],
	]);

	const toggleSort = (field: string) => {
		if (querySort === field) {
			if (queryOrder === "asc") {
				const nextOrder = "desc";
				setQueryOrder(nextOrder);
				updateParams({ order: nextOrder });
			} else {
				setQuerySort("default");
				setQueryOrder("asc");
				updateParams({ sort: "default", order: "asc" });
			}
		} else {
			setQuerySort(field);
			setQueryOrder("asc");
			updateParams({ sort: field, order: "asc" });
		}
	};

	const renderSortIcon = (field: string) => {
		if (querySort !== field)
			return <ArrowUpDown className="h-3 w-3 opacity-30" />;
		return queryOrder === "asc" ? (
			<ArrowUp className="h-3 w-3" />
		) : (
			<ArrowDown className="h-3 w-3" />
		);
	};

	const selectedTaskInstructionUrl = selectedTask
		? `${zealtConfig.github_repo}/tree/main/tasks/${selectedTask}`
		: "";

	const selectedTaskInstruction = selectedTask
		? tasksData.find((task) => task.taskName === selectedTask)?.instruction ||
			""
		: "";

	const instructionBody = (
		<>
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-7 sm:py-5">
				{selectedTask ? (
					selectedTaskInstruction ? (
						<pre className="wrap-break-word m-0 whitespace-pre-wrap p-0 font-mono text-foreground/95 text-xs leading-6 sm:text-sm sm:leading-7">
							{selectedTaskInstruction}
						</pre>
					) : (
						<div className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 text-muted-foreground text-sm">
							This task has no instruction content.
						</div>
					)
				) : (
					<Skeleton className="h-28 w-full" />
				)}
			</div>

			<div className="shrink-0 border-border/60 border-t bg-card/80 px-5 py-3 sm:px-7">
				<Button
					variant="outline"
					asChild
					className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm"
				>
					<a
						href={selectedTaskInstructionUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						<ExternalLink className="h-4 w-4" />
						Open
					</a>
				</Button>
			</div>
		</>
	);

	return (
		<div className="container mx-auto flex h-[100dvh] max-w-screen-2xl flex-col overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
			<div className="mb-6 shrink-0 space-y-4">
				<div className="flex items-center gap-4">
					<BackToLeaderboard />
				</div>
				<div>
					<h1 className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text font-bold text-4xl text-transparent tracking-tight">
						Task
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">
						Detailed breakdown of individual task performance across different
						models.
					</p>
				</div>
			</div>

			<div className="mb-6 flex shrink-0 flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm transition-all md:flex-row md:items-center">
				<div className="flex w-full flex-wrap items-center gap-4 md:w-auto">
					<div
						className={cn(
							"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
							hasActiveFilters
								? "bg-primary/10 text-primary"
								: "bg-secondary/50 text-muted-foreground",
						)}
						title="Filters"
					>
						<Filter className="h-4 w-4" />
					</div>

					<div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4">
						<MultiSelect
							title="Status"
							options={["passed", "failed", "error"]}
							selected={selectedStatuses}
							onChange={(vals) => {
								setSelectedStatuses(vals);
								updateParams({ status: vals });
							}}
							className="w-full sm:w-[140px]"
						/>

						<MultiSelect
							title="Models"
							options={allModels}
							selected={selectedModels}
							onChange={(vals) => {
								setSelectedModels(vals);
								updateParams({ model: vals });
							}}
							className="w-full sm:w-auto sm:min-w-[180px]"
						/>
					</div>

					{hasActiveFilters && (
						<button
							type="button"
							onClick={() => {
								setSearchQuery("");
								setQueryQ("");
								setSelectedStatuses([]);
								setSelectedModels([]);
								setSelectedAgents([]);
								setQuerySort("default");
								setQueryOrder("asc");
								router.replace(pathname, { scroll: false });
							}}
							className="ml-auto flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-4 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-secondary/80 sm:w-auto md:ml-0"
						>
							<X className="h-4 w-4" />
							Clear Filters
						</button>
					)}
				</div>

				<div className="relative w-full md:w-72">
					<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search tasks..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full rounded-lg border border-border bg-background py-2 pr-4 pl-9 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>
			</div>

			<div className="fade-in relative flex max-h-full animate-in flex-col overflow-hidden rounded-xl border border-border bg-card/50 pb-1 shadow-sm backdrop-blur-sm duration-500">
				{noTrials ? (
					<TableWrapper hasRows={tableTasks.length > 0}>
						<table className="w-full border-collapse text-left text-sm">
							<thead className="sticky top-0 z-30 select-none border-border border-b font-medium text-muted-foreground shadow-sm">
								<tr>
									<th className="left-0 z-40 w-[200px] min-w-[200px] max-w-[200px] border-border/50 border-r bg-secondary/95 px-3 py-3 backdrop-blur sm:px-6 md:sticky md:w-[350px] md:min-w-[350px] md:max-w-[350px] md:bg-[#f6f6f6] dark:md:bg-[#0f0f0f]">
										<div className="flex items-center gap-1 sm:gap-2">
											<span className="truncate">
												Task Name ({tableTasks.length} tasks)
											</span>
										</div>
									</th>
									<th className="min-w-[220px] border-0 bg-transparent p-0"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{tableTasks.map((task, index) => (
									<tr
										key={task.taskName}
										className="transition-colors duration-200"
									>
										<td className="left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] border-border/50 border-r bg-background p-0 font-mono md:sticky md:w-[350px] md:min-w-[350px] md:max-w-[350px] md:shadow-[1px_0_0_rgba(0,0,0,0.05)]">
											<button
												type="button"
												onClick={() => {
													setSelectedTask(task.taskName);
													setIsInstructionOpen(true);
												}}
												className="group/task flex h-full w-full cursor-pointer items-center gap-2 bg-transparent px-3 py-2 text-left text-foreground transition-colors even:bg-secondary/5 hover:bg-secondary/30 hover:text-primary focus:outline-none sm:px-6"
												title={`View ${task.taskName} instruction`}
											>
												<span className="block w-full truncate text-xs group-hover/task:underline md:text-sm">
													{task.taskName}
												</span>
											</button>
										</td>
										{index === 0 ? (
											<td
												rowSpan={tableTasks.length}
												className="min-w-[220px] border-border/50 border-l px-3 pt-10 pb-2 text-center align-top text-xs sm:px-6 md:text-sm"
											>
												<span className="font-medium text-foreground/90">
													No evaluation data yet
												</span>
											</td>
										) : null}
									</tr>
								))}
							</tbody>
						</table>
					</TableWrapper>
				) : (
					<TableWrapper hasRows={tableTasks.length > 0}>
						<table className="w-full border-collapse text-left text-sm">
							<thead className="sticky top-0 z-30 select-none border-border border-b bg-secondary/95 font-medium text-muted-foreground shadow-sm backdrop-blur">
								<tr>
									<th
										className="group left-0 z-40 w-[200px] min-w-[200px] max-w-[200px] cursor-pointer border-border/50 border-r bg-transparent px-3 py-3 transition-colors hover:bg-secondary/50 hover:text-foreground sm:px-6 md:sticky md:w-[350px] md:min-w-[350px] md:max-w-[350px] md:bg-[#f6f6f6] md:shadow-[1px_0_0_rgba(0,0,0,0.05)] dark:md:bg-[#0f0f0f]"
										onClick={() => toggleSort("taskName")}
									>
										<div className="flex items-center gap-1 sm:gap-2">
											<span className="truncate">
												Task Name ({tableTasks.length} tasks)
											</span>
											{renderSortIcon("taskName")}
										</div>
									</th>
									{activeCombos.map((combo) => (
										<th
											key={combo}
											className="min-w-[120px] border-border/50 border-l px-3 py-3 text-left sm:px-6 md:min-w-[150px]"
										>
											<div className="flex flex-col items-start">
												<span
													className="max-w-[100px] truncate font-medium text-foreground md:max-w-[130px]"
													title={combo.split(" (")[0]}
												>
													{combo.split(" (")[0]}
												</span>
											</div>
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{tableTasks.map((task) => (
									<tr
										key={task.taskName}
										className="group transition-colors duration-200 even:bg-secondary/5 hover:bg-secondary/30"
									>
										<td className="left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] border-border/50 border-r bg-background p-0 font-mono md:sticky md:w-[350px] md:min-w-[350px] md:max-w-[350px] md:shadow-[1px_0_0_rgba(0,0,0,0.05)]">
											<button
												type="button"
												onClick={() => {
													setSelectedTask(task.taskName);
													setIsInstructionOpen(true);
												}}
												className="group/task flex h-full w-full cursor-pointer items-center gap-2 bg-transparent px-3 py-2 text-left text-foreground transition-colors hover:text-primary focus:outline-none group-even:bg-secondary/5 group-hover:bg-secondary/30 sm:px-6"
												title={`View ${task.taskName} instruction`}
											>
												<span className="block w-full truncate text-xs group-hover/task:underline md:text-sm">
													{task.taskName}
												</span>
											</button>
										</td>
										{activeCombos.map((combo) => {
											const trial = task.comboMap[combo];
											return (
												<td
													key={combo}
													className="relative z-10 h-full min-w-[120px] border-border/50 border-l p-0 md:min-w-[150px]"
												>
													{trial ? (
														<HoverCard openDelay={200} closeDelay={0}>
															<HoverCardTrigger asChild>
																<Link
																	href={`/jobs/${encodeURIComponent(trial.job_name)}/${encodeURIComponent(trial.trial_name)}/run`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="group/cell absolute inset-0 m-0 flex h-full w-full cursor-pointer items-center justify-start gap-1.5 border-none bg-transparent p-0 px-3 text-left transition-colors hover:bg-secondary/50 focus:outline-none sm:px-6 md:gap-2"
																>
																	{trial.error ? (
																		<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500/90 md:h-4 md:w-4" />
																	) : trial.passed ? (
																		<Check
																			className="h-3.5 w-3.5 shrink-0 text-emerald-500/90 md:h-4 md:w-4"
																			strokeWidth={3}
																		/>
																	) : (
																		<XIcon
																			className="h-3.5 w-3.5 shrink-0 text-amber-500/90 md:h-4 md:w-4"
																			strokeWidth={3}
																		/>
																	)}
																	<span className="font-mono text-muted-foreground/80 text-xs transition-colors group-hover/cell:text-foreground group-hover/cell:underline md:text-sm">
																		{trial.exec_duration
																			? `${trial.exec_duration.toFixed(1)}s`
																			: "-"}
																	</span>
																</Link>
															</HoverCardTrigger>
															<HoverCardContent
																side="top"
																align="center"
																className="z-50 w-64 border-border bg-popover p-4 shadow-xl"
															>
																<div className="mb-3 flex items-center gap-2 border-border/50 border-b pb-3">
																	{trial.error ? (
																		<>
																			<AlertTriangle className="h-4 w-4 text-red-500" />
																			<span className="font-medium text-red-500">
																				Error
																			</span>
																		</>
																	) : trial.passed ? (
																		<>
																			<Check
																				className="h-4 w-4 text-emerald-500"
																				strokeWidth={3}
																			/>
																			<span className="font-medium text-emerald-500">
																				Passed
																			</span>
																		</>
																	) : (
																		<>
																			<XIcon
																				className="h-4 w-4 text-amber-500"
																				strokeWidth={3}
																			/>
																			<span className="font-medium text-amber-500">
																				Failed
																			</span>
																		</>
																	)}
																</div>
																<div className="space-y-2.5 text-left text-popover-foreground text-xs">
																	<div className="flex items-center justify-between">
																		<span className="text-muted-foreground">
																			Setup Environment
																		</span>
																		<span className="font-mono">
																			{trial.latency_breakdown.env_setup?.toFixed(
																				1,
																			) || "-"}
																			s
																		</span>
																	</div>
																	<div className="flex items-center justify-between">
																		<span className="text-muted-foreground">
																			Setup
																		</span>
																		<span className="font-mono">
																			{trial.latency_breakdown.agent_setup?.toFixed(
																				1,
																			) || "-"}
																			s
																		</span>
																	</div>
																	<div className="-mx-2 flex items-center justify-between rounded bg-secondary/40 px-2 py-1.5 font-medium">
																		<span className="text-foreground">
																			Execution
																		</span>
																		<span className="font-mono text-primary">
																			{trial.latency_breakdown.agent_exec?.toFixed(
																				1,
																			) || "-"}
																			s
																		</span>
																	</div>
																	<div className="flex items-center justify-between">
																		<span className="text-muted-foreground">
																			Verify Result
																		</span>
																		<span className="font-mono">
																			{trial.latency_breakdown.verifier?.toFixed(
																				1,
																			) || "-"}
																			s
																		</span>
																	</div>
																</div>
															</HoverCardContent>
														</HoverCard>
													) : (
														<div className="flex h-full w-full items-center justify-start py-2 pl-3 font-mono text-muted-foreground/30 text-xs sm:pl-6 md:text-sm">
															-
														</div>
													)}
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</TableWrapper>
				)}
			</div>

			{isDesktop ? (
				<Sheet open={isInstructionOpen} onOpenChange={setIsInstructionOpen}>
					<SheetContent
						side="right"
						className="data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 h-full min-h-0 w-[640px] max-w-[90vw] border-border/70 border-l bg-card/80 p-0 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-220 data-[state=open]:duration-320 lg:w-[680px] xl:w-[760px] 2xl:w-[820px]"
					>
						<div className="flex h-full min-h-0 flex-col">
							<SheetHeader className="border-border/60 border-b bg-card/80 px-7 py-5 pr-14">
								<SheetTitle className="text-base">
									{selectedTask || "Task Instruction"}
								</SheetTitle>
								<SheetDescription className="sr-only">
									{selectedTask}
								</SheetDescription>
							</SheetHeader>
							{instructionBody}
						</div>
					</SheetContent>
				</Sheet>
			) : (
				<Drawer
					open={isInstructionOpen}
					onOpenChange={setIsInstructionOpen}
					direction="bottom"
				>
					<DrawerContent className="inset-x-0 bottom-0 h-[76dvh] max-h-[76dvh] rounded-t-2xl border-border/70 border-t bg-card/95 p-0">
						<div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-muted-foreground/40" />
						<div className="flex h-full min-h-0 flex-col">
							<DrawerHeader className="border-border/60 border-b px-5 pb-4">
								<DrawerTitle className="text-base">
									{selectedTask || "Task Instruction"}
								</DrawerTitle>
								<SheetDescription className="sr-only">
									{selectedTask}
								</SheetDescription>
							</DrawerHeader>
							{instructionBody}
						</div>
					</DrawerContent>
				</Drawer>
			)}

			<BackToTop />
		</div>
	);
}
