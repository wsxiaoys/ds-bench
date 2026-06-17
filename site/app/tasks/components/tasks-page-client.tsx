"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
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
	useRef,
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
import { ScrollBar } from "@/components/ui/scroll-area";
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
import {
	hideCellPreview,
	showCellPreview,
	TaskCellPreviewLayer,
} from "./task-cell-preview";

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
	tags?: string[];
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

export function TasksPageClient({ tasksData }: TasksPageClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [queryQ, setQueryQ] = useState("");
	const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
	const [selectedModels, setSelectedModels] = useState<string[]>([]);
	const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [querySort, setQuerySort] = useState("default");
	const [queryOrder, setQueryOrder] = useState("asc");
	const [selectedTask, setSelectedTask] = useState<string | null>(null);
	const [isInstructionOpen, setIsInstructionOpen] = useState(false);
	const replaceUrlTimerRef = useRef<number | null>(null);
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const [devMode, setDevMode] = useState(
		process.env.NODE_ENV === "development",
	);

	const hasActiveFilters =
		selectedStatuses.length > 0 ||
		selectedModels.length > 0 ||
		selectedAgents.length > 0 ||
		selectedTags.length > 0 ||
		queryQ !== "" ||
		querySort !== "default";

	const scheduleReplaceUrl = useCallback(
		(nextUrl: string) => {
			if (replaceUrlTimerRef.current) {
				window.clearTimeout(replaceUrlTimerRef.current);
			}

			replaceUrlTimerRef.current = window.setTimeout(() => {
				router.replace(nextUrl, { scroll: false });
				replaceUrlTimerRef.current = null;
			}, 100);
		},
		[router],
	);

	useEffect(
		() => () => {
			if (replaceUrlTimerRef.current) {
				window.clearTimeout(replaceUrlTimerRef.current);
			}
		},
		[],
	);

	const updateParams = useCallback(
		(updates: {
			q?: string;
			status?: string[];
			model?: string[];
			agent?: string[];
			tags?: string[];
			sort?: string;
			order?: string;
		}) => {
			const nextQ = updates.q ?? queryQ;
			const nextStatuses = updates.status ?? selectedStatuses;
			const nextModels = updates.model ?? selectedModels;
			const nextAgents = updates.agent ?? selectedAgents;
			const nextTags = updates.tags ?? selectedTags;
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
			if (nextTags.length > 0) {
				params.set("tags", nextTags.join(","));
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
			scheduleReplaceUrl(nextUrl);
		},
		[
			pathname,
			queryOrder,
			queryQ,
			querySort,
			scheduleReplaceUrl,
			selectedAgents,
			selectedModels,
			selectedStatuses,
			selectedTags,
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
		const initialTags = (params.get("tags") || "").split(",").filter(Boolean);
		const initialSort = params.get("sort") || "default";
		const initialOrder = params.get("order") || "asc";
		const initialDevMode =
			process.env.NODE_ENV === "development" ||
			localStorage.getItem("devMode") === "true";

		setQueryQ(initialQ);
		setSelectedStatuses(initialStatuses);
		setSelectedModels(initialModels);
		setSelectedAgents(initialAgents);
		setSelectedTags(initialTags);
		setQuerySort(initialSort);
		setQueryOrder(initialOrder);
		setDevMode(initialDevMode);
	}, []);

	const handleSearchQueryChange = useCallback(
		(nextQuery: string) => {
			setQueryQ(nextQuery);
			updateParams({ q: nextQuery });
		},
		[updateParams],
	);

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

	const allTags = useMemo(() => {
		const tags = new Set<string>();

		tasksData.forEach((task) => {
			task.tags?.forEach((tag) => {
				tags.add(tag);
			});
		});

		return Array.from(tags).sort();
	}, [tasksData]);

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
		const query = queryQ.trim().toLowerCase();

		const filteredByTags =
			selectedTags.length > 0
				? tasksData.filter((task) =>
						selectedTags.some((tag) => task.tags?.includes(tag)),
					)
				: tasksData;

		if (noTrials) {
			const filtered = query
				? filteredByTags.filter((task) =>
						task.taskName.toLowerCase().includes(query),
					)
				: filteredByTags;

			return [...filtered]
				.map((task) => ({
					taskName: task.taskName,
					tags: task.tags,
					comboMap: {} as Record<string, CompactTrial>,
					avgDuration: 0,
				}))
				.sort((a, b) =>
					queryOrder === "desc"
						? b.taskName.localeCompare(a.taskName)
						: a.taskName.localeCompare(b.taskName),
				);
		}

		const result = filteredByTags
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
					tags: task.tags,
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

		return result.map(({ taskName, tags, comboMap, avgDuration }) => ({
			taskName,
			tags,
			comboMap,
			avgDuration,
		}));
	}, [
		activeCombos,
		noTrials,
		queryOrder,
		queryQ,
		querySort,
		tasksData,
		selectedStatuses.length,
		selectedStatuses.includes,
		selectedModels[0],
		selectedTags.some,
		selectedTags.length,
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
		<div className="container mx-auto flex h-dvh max-w-(--breakpoint-2xl) flex-col overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
			<div className="mb-6 shrink-0 space-y-4">
				<div className="flex items-center gap-4">
					<BackToLeaderboard />
				</div>
				<div>
					<h1 className="bg-linear-to-b from-foreground to-foreground/50 bg-clip-text font-bold text-4xl text-transparent tracking-tight">
						Task
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">
						Detailed breakdown of individual task performance across different
						models.
					</p>
				</div>
			</div>

			<div className="mb-6 flex shrink-0 flex-col items-start justify-between gap-4 rounded-lg border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm transition-all md:flex-row md:items-center">
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
							className="w-full sm:w-35"
						/>

						<MultiSelect
							title="Models"
							options={allModels}
							selected={selectedModels}
							onChange={(vals) => {
								setSelectedModels(vals);
								updateParams({ model: vals });
							}}
							className="w-full sm:w-auto sm:min-w-45"
						/>

						{allTags.length > 0 && (
							<MultiSelect
								title="Tags"
								options={allTags}
								selected={selectedTags}
								onChange={(vals) => {
									setSelectedTags(vals);
									updateParams({ tags: vals });
								}}
								className="w-full sm:w-auto sm:min-w-45"
							/>
						)}
					</div>

					{hasActiveFilters && (
						<button
							type="button"
							onClick={() => {
								setQueryQ("");
								setSelectedStatuses([]);
								setSelectedModels([]);
								setSelectedAgents([]);
								setSelectedTags([]);
								setQuerySort("default");
								setQueryOrder("asc");
								updateParams({
									q: "",
									status: [],
									model: [],
									agent: [],
									tags: [],
									sort: "default",
									order: "asc",
								});
							}}
							className="ml-auto flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-4 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-secondary/80 sm:w-auto md:ml-0"
						>
							<X className="h-4 w-4" />
							Clear Filters
						</button>
					)}
				</div>

				<TaskSearchInput
					value={queryQ}
					onDebouncedChange={handleSearchQueryChange}
				/>
			</div>

			<div className="fade-in relative flex max-h-full animate-in flex-col overflow-hidden rounded-lg border border-border bg-card/50 shadow-sm backdrop-blur-sm duration-500">
				{noTrials ? (
					<TableWrapper
						hasRows={tableTasks.length > 0}
						onScroll={hideCellPreview}
					>
						<table className="w-full border-collapse text-left text-sm">
							<thead className="sticky top-0 z-30 select-none border-border border-b font-medium text-muted-foreground shadow-sm">
								<tr>
									<th className="relative left-0 z-40 w-50 min-w-50 max-w-50 bg-secondary px-3 py-3 backdrop-blur after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/50 after:content-[''] sm:px-6 md:sticky md:w-87.5 md:min-w-87.5 md:max-w-87.5">
										<div className="flex items-center gap-1 sm:gap-2">
											<span className="truncate">
												Task Name ({tableTasks.length} tasks)
											</span>
										</div>
									</th>
									<th className="min-w-55 border-0 bg-transparent p-0"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{tableTasks.map((task, index) => (
									<tr
										key={task.taskName}
										className="transition-colors duration-200"
									>
										<td className="relative left-0 z-20 w-50 min-w-50 max-w-50 bg-background p-0 font-mono after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/50 after:content-[''] md:sticky md:w-87.5 md:min-w-87.5 md:max-w-87.5">
											<button
												type="button"
												onClick={() => {
													setSelectedTask(task.taskName);
													setIsInstructionOpen(true);
												}}
												className="group/task flex h-full w-full cursor-pointer flex-col items-start justify-center gap-1 bg-transparent px-3 py-2 text-left text-foreground transition-colors even:bg-secondary/5 hover:bg-secondary/30 hover:text-primary focus:outline-none sm:px-6"
												title={`View ${task.taskName} instruction`}
											>
												<span className="block w-full truncate text-xs group-hover/task:underline md:text-sm">
													{task.taskName}
												</span>
												{task.tags && task.tags.length > 0 && (
													<div className="mt-0.5 flex flex-wrap gap-1">
														{task.tags.map((tag) => (
															<span
																key={tag}
																className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary"
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</button>
										</td>
										{index === 0 ? (
											<td
												rowSpan={tableTasks.length}
												className="min-w-55 px-3 pt-10 pb-2 text-center align-top text-xs sm:px-6 md:text-sm"
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
					<TableWrapper
						hasRows={tableTasks.length > 0}
						onScroll={hideCellPreview}
					>
						<table className="w-full border-collapse text-left text-sm">
							<thead className="sticky top-0 z-30 select-none border-border border-b bg-secondary font-medium text-muted-foreground shadow-sm backdrop-blur">
								<tr>
									<th
										className="group relative left-0 z-40 w-50 min-w-50 max-w-50 cursor-pointer bg-transparent px-3 py-3 transition-colors after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/50 after:content-[''] hover:text-foreground sm:px-6 md:sticky md:w-87.5 md:min-w-87.5 md:max-w-87.5 md:bg-secondary"
										onClick={() => toggleSort("taskName")}
									>
										<div className="flex items-center gap-1 sm:gap-2">
											<span className="truncate">
												Task Name ({tableTasks.length} tasks)
											</span>
											{renderSortIcon("taskName")}
										</div>
									</th>
									{activeCombos.map((combo, index) => (
										<th
											key={combo}
											className={cn(
												"min-w-30 px-3 py-3 text-left sm:px-6 md:min-w-37.5",
												index > 0 && "border-border/50 border-l",
											)}
										>
											<div className="flex flex-col items-start">
												<span
													className="max-w-25 truncate font-medium text-foreground md:max-w-32.5"
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
										<td className="relative left-0 z-20 w-50 min-w-50 max-w-50 bg-background p-0 font-mono after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/50 after:content-[''] md:sticky md:w-87.5 md:min-w-87.5 md:max-w-87.5">
											<button
												type="button"
												onClick={() => {
													setSelectedTask(task.taskName);
													setIsInstructionOpen(true);
												}}
												className="group/task flex h-full w-full cursor-pointer flex-col items-start justify-center gap-1 bg-transparent px-3 py-2 text-left text-foreground transition-colors hover:text-primary focus:outline-none group-even:bg-secondary/5 group-hover:bg-secondary/30 sm:px-6"
												title={`View ${task.taskName} instruction`}
											>
												<span className="block w-full truncate text-xs group-hover/task:underline md:text-sm">
													{task.taskName}
												</span>
												{task.tags && task.tags.length > 0 && (
													<div className="mt-0.5 flex flex-wrap gap-1">
														{task.tags.map((tag) => (
															<span
																key={tag}
																className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary"
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</button>
										</td>
										{activeCombos.map((combo, index) => {
											const trial = task.comboMap[combo];
											return (
												<td
													key={combo}
													className={cn(
														"relative z-10 h-full min-w-30 p-0 md:min-w-37.5",
														index > 0 && "border-border/50 border-l",
													)}
												>
													{trial ? (
														<Link
															href={`/jobs/${encodeURIComponent(trial.job_name)}/${encodeURIComponent(trial.trial_name)}/run`}
															target="_blank"
															rel="noopener noreferrer"
															className="group/cell absolute inset-0 m-0 flex h-full w-full cursor-pointer items-center justify-start gap-1.5 border-none bg-transparent p-0 px-3 text-left transition-colors hover:bg-secondary/50 focus:outline-none sm:px-6 md:gap-2"
															onPointerEnter={(event) =>
																showCellPreview(event.currentTarget, trial)
															}
															onPointerLeave={hideCellPreview}
															onFocus={(event) =>
																showCellPreview(event.currentTarget, trial)
															}
															onBlur={hideCellPreview}
															onClick={hideCellPreview}
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
													) : (
														<div
															className="group/cell absolute inset-0 m-0 flex h-full w-full cursor-help items-center justify-start bg-transparent p-0 px-3 text-left transition-colors hover:bg-secondary/20 focus:outline-none sm:px-6"
															onPointerEnter={(event) =>
																showCellPreview(event.currentTarget, null)
															}
															onPointerLeave={hideCellPreview}
														>
															<span className="font-mono text-muted-foreground/30 text-xs md:text-sm">
																-
															</span>
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

			<TaskCellPreviewLayer />

			{isDesktop ? (
				<Sheet open={isInstructionOpen} onOpenChange={setIsInstructionOpen}>
					<SheetContent
						side="right"
						className="data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 h-full min-h-0 w-160 max-w-[90vw] border-border/70 border-l bg-card/80 p-0 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-220 data-[state=open]:duration-320 lg:w-170 xl:w-190 2xl:w-205"
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
					<DrawerContent className="inset-x-0 bottom-0 h-[76dvh] max-h-[76dvh] rounded-t-lg border-border/70 border-t bg-card/95 p-0">
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

type TableWrapperProps = {
	hasRows: boolean;
	children: ReactNode;
	onScroll?: () => void;
};

function TableWrapper({ hasRows, children, onScroll }: TableWrapperProps) {
	if (!hasRows) {
		return (
			<div className="flex flex-1 items-center justify-center py-12 text-center text-muted-foreground">
				No tasks found matching your filters
			</div>
		);
	}

	return (
		<ScrollAreaPrimitive.Root className="relative min-h-0 flex-1">
			<ScrollAreaPrimitive.Viewport
				className="h-full w-full rounded-[inherit]"
				onScroll={onScroll}
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar className="top-11 bottom-2 h-auto" />
			<ScrollBar orientation="horizontal" />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

type TaskSearchInputProps = {
	value: string;
	onDebouncedChange: (value: string) => void;
};

function TaskSearchInput({ value, onDebouncedChange }: TaskSearchInputProps) {
	const [inputValue, setInputValue] = useState(value);

	useEffect(() => {
		setInputValue(value);
	}, [value]);

	useEffect(() => {
		if (inputValue === value) {
			return;
		}

		const timer = window.setTimeout(() => {
			onDebouncedChange(inputValue);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [inputValue, onDebouncedChange, value]);

	return (
		<div className="relative w-full md:w-72">
			<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search tasks..."
				value={inputValue}
				onChange={(event) => setInputValue(event.target.value)}
				className="w-full rounded-lg border border-border bg-background py-2 pr-4 pl-9 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
			/>
		</div>
	);
}
