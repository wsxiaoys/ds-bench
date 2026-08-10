"use client";

import { AlertTriangle, Check, Clock, X as XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type CompactTrial, getPassRateStyle } from "./tasks-page-client";

type CellPreview = {
	trials: CompactTrial[] | null;
	left: number;
	top: number;
	placement: "top" | "bottom";
};

type CellPreviewShowDetail = {
	target: HTMLElement;
	trials: CompactTrial[] | null;
};

const CellPreviewShowEvent = "tasks-cell-preview:show";
const CellPreviewHideEvent = "tasks-cell-preview:hide";
const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 150;

export function showCellPreview(
	target: HTMLElement,
	trials: CompactTrial[] | null,
) {
	window.dispatchEvent(
		new CustomEvent<CellPreviewShowDetail>(CellPreviewShowEvent, {
			detail: { target, trials },
		}),
	);
}

export function hideCellPreview() {
	window.dispatchEvent(new Event(CellPreviewHideEvent));
}

function getCellPreviewPosition(rect: DOMRect): Omit<CellPreview, "trials"> {
	const previewWidth = 256;
	const viewportPadding = 8;
	const gap = 8;
	const left = Math.min(
		Math.max(rect.left + rect.width / 2 - previewWidth / 2, viewportPadding),
		window.innerWidth - previewWidth - viewportPadding,
	);
	const placement = rect.top > 180 ? "top" : "bottom";

	return {
		left,
		top: placement === "top" ? rect.top - gap : rect.bottom + gap,
		placement,
	};
}

function SingleTrialDetails({ trial }: { trial: CompactTrial }) {
	return (
		<>
			<div className="mb-3 flex items-center gap-2 border-border/50 border-b pb-3">
				{trial.error ? (
					<>
						{trial.error === "AgentTimeoutError" ? (
							<Clock className="h-4 w-4 text-red-400" />
						) : (
							<AlertTriangle className="h-4 w-4 text-red-400" />
						)}
						<span className="font-medium text-red-400">
							{typeof trial.error === "string" ? trial.error : "Error"}
						</span>
					</>
				) : trial.passed ? (
					<>
						<Check className="h-4 w-4 text-emerald-500" strokeWidth={3} />
						<span className="font-medium text-emerald-500">Passed</span>
					</>
				) : (
					<>
						<XIcon className="h-4 w-4 text-amber-500" strokeWidth={3} />
						<span className="font-medium text-amber-500">Failed</span>
					</>
				)}
			</div>
			<div className="space-y-2.5 text-left text-popover-foreground text-xs">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Setup Environment</span>
					<span className="font-mono">
						{trial.latency_breakdown.env_setup?.toFixed(1) || "-"}s
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Setup</span>
					<span className="font-mono">
						{trial.latency_breakdown.agent_setup?.toFixed(1) || "-"}s
					</span>
				</div>
				<div className="-mx-2 flex items-center justify-between rounded bg-secondary/40 px-2 py-1.5 font-medium">
					<span className="text-foreground">Execution</span>
					<span className="font-mono text-primary">
						{trial.latency_breakdown.agent_exec?.toFixed(1) || "-"}s
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Verify Result</span>
					<span className="font-mono">
						{trial.latency_breakdown.verifier?.toFixed(1) || "-"}s
					</span>
				</div>
				<div className="-mx-2 mt-1 flex items-center justify-between rounded bg-secondary/40 px-2 py-1.5 font-medium">
					<span className="text-foreground">Total Tokens</span>
					<span className="font-mono text-primary">
						{formatTokenCount(trial.tokens.input + trial.tokens.output)}
					</span>
				</div>
				<div className="flex items-center justify-between pl-2">
					<span className="text-muted-foreground">Input</span>
					<span className="font-mono">
						{formatTokenCount(trial.tokens.input)}
					</span>
				</div>
				<div className="flex items-center justify-between pl-2">
					<span className="text-muted-foreground">Cache</span>
					<span className="font-mono">
						{formatTokenCount(trial.tokens.cache)}
					</span>
				</div>
				<div className="flex items-center justify-between pl-2">
					<span className="text-muted-foreground">Output</span>
					<span className="font-mono">
						{formatTokenCount(trial.tokens.output)}
					</span>
				</div>
			</div>
		</>
	);
}

function MultiTrialSummary({ trials }: { trials: CompactTrial[] }) {
	const total = trials.length;
	const passed = trials.filter((t) => t.passed).length;
	const rate = total > 0 ? passed / total : 0;
	const style = getPassRateStyle(rate);

	return (
		<>
			<div className="mb-3 flex items-center gap-2 border-border/50 border-b pb-3">
				<span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
				<span className={cn("font-medium", style.text)}>
					{passed}/{total} trials passed
				</span>
			</div>
			<div className="max-h-48 space-y-1.5 overflow-y-auto text-left text-popover-foreground text-xs">
				{trials.map((trial, idx) => (
					<Link
						key={`${trial.job_name}/${trial.trial_name}`}
						href={`/jobs/${encodeURIComponent(trial.job_name)}/${encodeURIComponent(trial.trial_name)}/run`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-between gap-2 rounded bg-secondary/30 px-2 py-1.5 transition-colors hover:bg-secondary/60"
						onClick={hideCellPreview}
					>
						<span className="flex min-w-0 items-center gap-1.5">
							{trial.error === "AgentTimeoutError" ? (
								<Clock className="h-3.5 w-3.5 shrink-0 text-red-400" />
							) : trial.error ? (
								<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
							) : trial.passed ? (
								<Check
									className="h-3.5 w-3.5 shrink-0 text-emerald-500"
									strokeWidth={3}
								/>
							) : (
								<XIcon
									className="h-3.5 w-3.5 shrink-0 text-amber-500"
									strokeWidth={3}
								/>
							)}
							<span className="truncate text-muted-foreground">
								Trial {idx + 1}
							</span>
						</span>
						<span className="shrink-0 font-mono">
							{trial.exec_duration ? `${trial.exec_duration.toFixed(1)}s` : "-"}
						</span>
					</Link>
				))}
			</div>
		</>
	);
}

function CellPreviewContent({ trials }: { trials: CompactTrial[] | null }) {
	if (!trials || trials.length === 0) {
		return (
			<div className="text-left text-popover-foreground text-xs">
				<p className="font-medium text-foreground/90">
					Evaluation result is not available yet
				</p>
				<p className="mt-1 text-muted-foreground">
					This model has not evaluated this task or the evaluation is still in
					progress.
				</p>
			</div>
		);
	}

	if (trials.length === 1) {
		return <SingleTrialDetails trial={trials[0]} />;
	}

	return <MultiTrialSummary trials={trials} />;
}


function formatTokenCount(value: number): string {
	if (!value) return "0";
	return value.toLocaleString();
}

type TaskCellPreviewProps = {
	preview: CellPreview;
	onPointerEnter: () => void;
	onPointerLeave: () => void;
};

function TaskCellPreview({
	preview,
	onPointerEnter,
	onPointerLeave,
}: TaskCellPreviewProps) {
	return (
		<div
			className={cn(
				"fixed z-50 w-64 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-xl",
				"fade-in-0 zoom-in-90 animate-in",
				"data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3",
				preview.placement === "top" && "-translate-y-full",
			)}
			data-side={preview.placement}
			style={{ left: preview.left, top: preview.top }}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
		>
			<CellPreviewContent trials={preview.trials} />
		</div>
	);
}

type TaskCellPreviewLayerProps = {
	scrollElement: HTMLElement | null;
};

export function TaskCellPreviewLayer({
	scrollElement,
}: TaskCellPreviewLayerProps) {
	const [preview, setPreview] = useState<CellPreview | null>(null);
	const previewRef = useRef<CellPreview | null>(null);
	const showTimerRef = useRef<number | null>(null);
	const hideTimerRef = useRef<number | null>(null);

	useEffect(() => {
		previewRef.current = preview;
	}, [preview]);

	const clearShowTimer = useCallback(() => {
		if (showTimerRef.current) {
			window.clearTimeout(showTimerRef.current);
			showTimerRef.current = null;
		}
	}, []);

	const clearHideTimer = useCallback(() => {
		if (hideTimerRef.current) {
			window.clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
	}, []);

	// Closes the preview right away, used for scroll events where lingering
	// would look glitchy.
	const closePreviewImmediate = useCallback(() => {
		clearShowTimer();
		clearHideTimer();
		if (!previewRef.current) {
			return;
		}
		previewRef.current = null;
		setPreview(null);
	}, [clearHideTimer, clearShowTimer]);

	// Hides the preview after a short delay instead of immediately, so the
	// pointer can travel from the trigger cell into the (now interactive)
	// preview panel without it disappearing first.
	const scheduleHide = useCallback(() => {
		clearShowTimer();
		if (!previewRef.current) {
			return;
		}

		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			previewRef.current = null;
			setPreview(null);
		}, HIDE_DELAY_MS);
	}, [clearHideTimer, clearShowTimer]);

	const schedulePreview = useCallback(
		({ target, trials }: CellPreviewShowDetail) => {
			clearHideTimer();
			clearShowTimer();

			const updatePreview = () => {
				if (!target.isConnected) {
					return;
				}

				showTimerRef.current = null;
				const nextPreview = {
					trials,
					...getCellPreviewPosition(target.getBoundingClientRect()),
				};
				previewRef.current = nextPreview;
				setPreview(nextPreview);
			};

			if (previewRef.current) {
				updatePreview();
				return;
			}

			showTimerRef.current = window.setTimeout(updatePreview, SHOW_DELAY_MS);
		},
		[clearHideTimer, clearShowTimer],
	);

	useEffect(() => {
		const handleShow = (event: Event) => {
			schedulePreview((event as CustomEvent<CellPreviewShowDetail>).detail);
		};

		window.addEventListener(CellPreviewShowEvent, handleShow);
		window.addEventListener(CellPreviewHideEvent, scheduleHide);

		return () => {
			window.removeEventListener(CellPreviewShowEvent, handleShow);
			window.removeEventListener(CellPreviewHideEvent, scheduleHide);
			clearShowTimer();
			clearHideTimer();
		};
	}, [clearHideTimer, clearShowTimer, scheduleHide, schedulePreview]);

	useEffect(() => {
		if (!scrollElement) {
			return;
		}

		scrollElement.addEventListener("scroll", closePreviewImmediate, {
			passive: true,
		});

		return () => {
			scrollElement.removeEventListener("scroll", closePreviewImmediate);
		};
	}, [closePreviewImmediate, scrollElement]);

	return preview ? (
		<TaskCellPreview
			preview={preview}
			onPointerEnter={clearHideTimer}
			onPointerLeave={scheduleHide}
		/>
	) : null;
}
