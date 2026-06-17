"use client";

import { type ClassValue, clsx } from "clsx";
import { ListTree, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import zealtConfig from "@/zealt/config.json";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export interface LeaderboardEntry {
	id: string;
	model: string;
	rawModel: string;
	agent: string;
	passedEvals: number;
	successRate: number;
	avgLatency: number;
	isNew?: boolean;
}

function ProgressBar({
	value,
	colorClass,
}: {
	value: number;
	colorClass: string;
}) {
	return (
		<div className="h-2 w-16 overflow-hidden rounded-full bg-secondary sm:w-24">
			<div
				className={cn(
					"h-full transition-all duration-500 ease-out",
					colorClass,
				)}
				style={{ width: `${value}%` }}
			/>
		</div>
	);
}

function ScoreCell({ value }: { value: number }) {
	let colorClass = "bg-primary";
	let textClass = "text-muted-foreground";

	if (value >= 90) {
		colorClass = "bg-emerald-500";
		textClass = "text-emerald-500 font-bold";
	} else if (value >= 75) {
		colorClass = "bg-blue-500";
		textClass = "text-blue-500 font-medium";
	} else if (value >= 60) {
		colorClass = "bg-amber-500";
		textClass = "text-amber-500";
	} else {
		colorClass = "bg-red-500";
		textClass = "text-red-500";
	}

	return (
		<div className="flex items-center gap-3">
			<span className={cn("w-12 text-right", textClass)}>{value}%</span>
			<ProgressBar value={value} colorClass={colorClass} />
		</div>
	);
}

export default function LeaderboardTable({
	data,
}: {
	data: LeaderboardEntry[];
}) {
	const router = useRouter();
	const [devMode, setDevMode] = useState(
		process.env.NODE_ENV === "development",
	);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const isDev =
			process.env.NODE_ENV === "development" ||
			localStorage.getItem("devMode") === "true";
		setDevMode(isDev);
	}, []);

	const filteredData = useMemo(() => {
		let processedData = data;
		const config = zealtConfig as { pending_models?: string[] };

		if (!devMode && config.pending_models && config.pending_models.length > 0) {
			processedData = processedData.filter(
				(item) => !config.pending_models?.includes(item.rawModel),
			);
		}

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			processedData = processedData.filter((item) =>
				item.model.toLowerCase().includes(query),
			);
		}

		return processedData;
	}, [data, searchQuery, devMode]);

	return (
		<>
			{/* Controls & Filters */}
			<div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<h2 className="flex items-center gap-2 font-semibold text-2xl">
					Model Performance
				</h2>

				<div className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center md:w-auto">
					<Link
						href="./tasks"
						className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card/50 px-4 py-2 font-medium text-foreground text-sm shadow-sm backdrop-blur-sm transition-colors hover:bg-secondary/50"
					>
						<ListTree className="h-4 w-4" />
						View Tasks
					</Link>

					<div className="relative w-full sm:w-auto">
						<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search models..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full rounded-lg border border-border bg-card py-2 pr-4 pl-9 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-64"
						/>
					</div>
				</div>
			</div>

			{/* Leaderboard Table */}
			<div className="overflow-hidden rounded-lg border border-border bg-card/50 shadow-xl backdrop-blur-sm">
				<div className="overflow-x-auto">
					<table className="w-full whitespace-nowrap text-left text-sm">
						<thead className="border-border border-b bg-secondary/50 font-medium text-muted-foreground">
							<tr>
								<th className="w-[40%] px-4 py-3 sm:px-6 sm:py-4">Model</th>
								<th className="w-[15%] px-4 py-3 text-center sm:px-6 sm:py-4">
									Passed
								</th>
								<th className="w-[15%] px-4 py-3 text-right sm:px-6 sm:py-4">
									Avg Duration
								</th>
								<th className="w-[30%] px-4 py-3 sm:px-6 sm:py-4">
									Success Rate
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{filteredData.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="px-4 py-8 text-center text-muted-foreground sm:px-6"
									>
										No results found matching your search.
									</td>
								</tr>
							) : (
								filteredData.map((row, index) => (
									<tr
										key={row.id}
										onClick={() =>
											router.push(
												`./tasks?model=${encodeURIComponent(row.model)}`,
											)
										}
										className="group cursor-pointer transition-colors duration-200 hover:bg-secondary/30"
									>
										<td className="flex items-center gap-2 px-4 py-3 font-medium text-foreground sm:gap-3 sm:px-6 sm:py-4">
											<span className="w-6 text-muted-foreground/50 text-xs">
												#{index + 1}
											</span>
											<div className="flex flex-col">
												<span className="flex items-center gap-2">
													{row.model}
													{index === 0 && (
														<Trophy className="h-3 w-3 text-yellow-500" />
													)}
													{row.isNew && (
														<span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-bold text-[10px] text-blue-500">
															NEW
														</span>
													)}
												</span>
											</div>
										</td>
										<td className="px-4 py-3 text-center font-mono text-muted-foreground sm:px-6 sm:py-4">
											{row.passedEvals}
										</td>
										<td className="px-4 py-3 text-right font-mono text-muted-foreground sm:px-6 sm:py-4">
											{row.avgLatency > 0
												? `${row.avgLatency.toFixed(1)}s`
												: "-"}
										</td>
										<td className="px-4 py-3 sm:px-6 sm:py-4">
											<div className="block w-full transition-opacity group-hover:opacity-80">
												<ScoreCell value={row.successRate} />
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
