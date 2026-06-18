"use client";

import { AlertTriangle, Check, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CompactTrial } from "./tasks-page-client";

type CellPreview = {
	trial: CompactTrial | null;
	left: number;
	top: number;
	placement: "top" | "bottom";
};

type CellPreviewShowDetail = {
	target: HTMLElement;
	trial: CompactTrial | null;
};

const CellPreviewShowEvent = "tasks-cell-preview:show";
const CellPreviewHideEvent = "tasks-cell-preview:hide";

export function showCellPreview(
	target: HTMLElement,
	trial: CompactTrial | null,
) {
	window.dispatchEvent(
		new CustomEvent<CellPreviewShowDetail>(CellPreviewShowEvent, {
			detail: { target, trial },
		}),
	);
}

export function hideCellPreview() {
	window.dispatchEvent(new Event(CellPreviewHideEvent));
}

function getCellPreviewPosition(rect: DOMRect): Omit<CellPreview, "trial"> {
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

function CellPreviewContent({ trial }: { trial: CompactTrial | null }) {
	if (!trial) {
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

	return (
		<>
			<div className="mb-3 flex items-center gap-2 border-border/50 border-b pb-3">
				{trial.error ? (
					<>
						<AlertTriangle className="h-4 w-4 text-red-500" />
						<span className="font-medium text-red-500">Error</span>
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
			</div>
		</>
	);
}

function TaskCellPreview({ preview }: { preview: CellPreview }) {
	return (
		<div
			className={cn(
				"pointer-events-none fixed z-50 w-64 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-xl",
				"fade-in-0 zoom-in-90 animate-in",
				"data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3",
				preview.placement === "top" && "-translate-y-full",
			)}
			data-side={preview.placement}
			style={{ left: preview.left, top: preview.top }}
		>
			<CellPreviewContent trial={preview.trial} />
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
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		previewRef.current = preview;
	}, [preview]);

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const closePreview = useCallback(() => {
		if (!previewRef.current && !timerRef.current) {
			return;
		}

		clearTimer();
		previewRef.current = null;
		setPreview(null);
	}, [clearTimer]);

	const schedulePreview = useCallback(
		({ target, trial }: CellPreviewShowDetail) => {
			clearTimer();

			const updatePreview = () => {
				if (!target.isConnected) {
					return;
				}

				timerRef.current = null;
				const nextPreview = {
					trial,
					...getCellPreviewPosition(target.getBoundingClientRect()),
				};
				previewRef.current = nextPreview;
				setPreview(nextPreview);
			};

			if (previewRef.current) {
				updatePreview();
				return;
			}

			timerRef.current = window.setTimeout(updatePreview, 300);
		},
		[clearTimer],
	);

	useEffect(() => {
		const handleShow = (event: Event) => {
			schedulePreview((event as CustomEvent<CellPreviewShowDetail>).detail);
		};

		window.addEventListener(CellPreviewShowEvent, handleShow);
		window.addEventListener(CellPreviewHideEvent, closePreview);

		return () => {
			window.removeEventListener(CellPreviewShowEvent, handleShow);
			window.removeEventListener(CellPreviewHideEvent, closePreview);
			clearTimer();
		};
	}, [clearTimer, closePreview, schedulePreview]);

	useEffect(() => {
		if (!scrollElement) {
			return;
		}

		scrollElement.addEventListener("scroll", closePreview, { passive: true });

		return () => {
			scrollElement.removeEventListener("scroll", closePreview);
		};
	}, [closePreview, scrollElement]);

	return preview ? <TaskCellPreview preview={preview} /> : null;
}
