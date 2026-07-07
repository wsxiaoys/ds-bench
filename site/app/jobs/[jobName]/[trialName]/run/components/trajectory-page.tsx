"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HttpError } from "@/lib/http-error";
import { AgentTrajectoryViewer } from "./agent-trajectory-viewer";
import { AnsiLog } from "./ansi-log";
import { type ArtifactNodeWithUrl, ArtifactsPanel } from "./artifacts-panel";

export type TabConfig = {
	value: string;
	label: React.ReactNode;
};

type TrajectoryPageProps = {
	trajectoryUrl: string | null;
	agentTrajectoryUrl?: string | null;
	browserVerificationUrls: { name: string; url: string }[];
	fallbackUrl: string;
	stderrLogUrl: string | null;
	verifierLogUrl: string | null;
	tabsConfig: TabConfig[];
	artifactTree?: ArtifactNodeWithUrl[];
};

export async function fetchLogText(url: string): Promise<string> {
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

	return response.text();
}

export function TrajectoryPage({
	trajectoryUrl,
	agentTrajectoryUrl,
	browserVerificationUrls,
	fallbackUrl,
	stderrLogUrl,
	verifierLogUrl,
	tabsConfig,
	artifactTree,
}: TrajectoryPageProps) {
	const { resolvedTheme } = useTheme();
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const [mounted, setMounted] = useState(false);
	const [iframeLoading, setIframeLoading] = useState(true);
	const [devModeEnabled, setDevModeEnabled] = useState(
		process.env.NODE_ENV === "development",
	);

	useEffect(() => {
		const isDev =
			process.env.NODE_ENV === "development" ||
			localStorage.getItem("devMode") === "true";
		setDevModeEnabled(isDev);
	}, []);

	const visibleTabsConfig = useMemo(
		() =>
			devModeEnabled
				? tabsConfig
				: tabsConfig.filter((t) => t.value !== "artifacts"),
		[tabsConfig, devModeEnabled],
	);
	const validTabs = visibleTabsConfig.map((t) => t.value);
	const [activeTab, setActiveTab] = useState(() => {
		const queryTab = searchParams.get("tab");
		return queryTab && validTabs.includes(queryTab) ? queryTab : validTabs[0];
	});

	const handleTabChange = (value: string) => {
		setActiveTab(value);
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", value);
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	};
	const [browserIframeLoading, setBrowserIframeLoading] = useState<
		Record<string, boolean>
	>({});
	const [activeBrowserVerificationTab, setActiveBrowserVerificationTab] =
		useState(browserVerificationUrls[0]?.name || "");

	const iframeTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

	const iframeUrl = useMemo(() => {
		if (!trajectoryUrl) return "";
		try {
			const url = new URL(trajectoryUrl);
			const hashParams = new URLSearchParams(url.hash.slice(1));
			hashParams.set("theme", iframeTheme);
			url.hash = hashParams.toString();
			return url.toString();
		} catch {
			return trajectoryUrl;
		}
	}, [trajectoryUrl, iframeTheme]);

	const activeBrowserVerificationBaseUrl = useMemo(() => {
		const testCase = browserVerificationUrls.find(
			(tc) => tc.name === activeBrowserVerificationTab,
		);
		return testCase ? testCase.url : null;
	}, [browserVerificationUrls, activeBrowserVerificationTab]);

	const activeBrowserVerificationUrl = useMemo(() => {
		if (!activeBrowserVerificationBaseUrl) {
			return null;
		}

		const url = new URL(activeBrowserVerificationBaseUrl);
		const hashParams = new URLSearchParams(url.hash.slice(1));
		hashParams.set("theme", iframeTheme);
		url.hash = hashParams.toString();
		return url.toString();
	}, [activeBrowserVerificationBaseUrl, iframeTheme]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted || !activeBrowserVerificationBaseUrl) {
			return;
		}

		setBrowserIframeLoading((prev) => ({
			...prev,
			[activeBrowserVerificationTab]: true,
		}));
	}, [activeBrowserVerificationBaseUrl, activeBrowserVerificationTab, mounted]);

	const stderrQuery = useQuery({
		queryKey: ["trajectory-stderr", stderrLogUrl],
		enabled: Boolean(stderrLogUrl),
		queryFn: async () => {
			if (!stderrLogUrl) {
				return null;
			}

			return fetchLogText(stderrLogUrl);
		},
	});

	const verifierQuery = useQuery({
		queryKey: ["trajectory-verifier", verifierLogUrl],
		enabled: Boolean(verifierLogUrl),
		queryFn: async () => {
			if (!verifierLogUrl) {
				return null;
			}

			return fetchLogText(verifierLogUrl);
		},
	});

	const handleIframeLoad = () => {
		setIframeLoading(false);
	};

	const handleBrowserIframeLoad = (testCaseName: string) => {
		setBrowserIframeLoading((prev) => ({ ...prev, [testCaseName]: false }));
	};

	const handleIframeError = () => {
		window.location.replace(fallbackUrl);
	};

	const renderLogContent = (
		text: string | null | undefined,
		isLoading: boolean,
		isError: boolean,
		error: unknown,
		onRetry: () => void,
		emptyMessage: string,
	) => {
		if (isLoading) {
			return <LogContentSkeleton />;
		}

		if (isError) {
			return (
				<LogErrorView message={getLogErrorMessage(error)} onRetry={onRetry} />
			);
		}

		if (!text) {
			return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
		}

		return <AnsiLog text={text} />;
	};

	return (
		<div className="h-full w-full pt-4 pb-4 sm:pt-5 sm:pb-6">
			<div className="mx-auto h-full w-full max-w-350 px-4 sm:px-7 lg:px-10">
				<Tabs
					value={activeTab}
					onValueChange={handleTabChange}
					className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background/70 shadow-md backdrop-blur-md"
				>
					<div className="border-border border-b bg-linear-to-b from-background/50 to-background/30 px-4 py-3.5 sm:px-5">
						<TabsList
							className={`flex h-10 w-full ${
								visibleTabsConfig.length <= 3 ? "sm:w-120" : "sm:w-160"
							} max-w-full items-stretch gap-1 rounded-xl border border-border/40 bg-muted/40 p-1`}
						>
							{visibleTabsConfig.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="h-full flex-1 cursor-pointer rounded-lg border-0 py-0 font-medium text-muted-foreground text-xs transition-all duration-200 hover:bg-background/20 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:text-sm"
								>
									<span className="leading-none">{tab.label}</span>
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					<TabsContent
						value="trajectory"
						className="relative min-h-0 flex-1 overflow-hidden"
						forceMount
					>
						{trajectoryUrl ? (
							<>
								<div
									className={`absolute inset-0 z-10 overflow-auto bg-background/80 transition-opacity delay-220 duration-420 ease-out ${!mounted || iframeLoading ? "opacity-100" : "pointer-events-none opacity-0"}`}
								>
									<TrajectorySkeleton />
								</div>
								{mounted && (
									<iframe
										src={iframeUrl}
										className={`h-full w-full border-0 transition-opacity duration-260 ease-out ${iframeLoading ? "opacity-0" : "opacity-100"}`}
										title="Trajectory Details"
										onLoad={handleIframeLoad}
										onError={handleIframeError}
									/>
								)}
							</>
						) : agentTrajectoryUrl ? (
							<AgentTrajectoryViewer url={agentTrajectoryUrl} />
						) : (
							<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
								No trajectory available.
							</div>
						)}
					</TabsContent>

					<TabsContent
						value="log"
						className="min-h-0 flex-1 overflow-hidden"
						forceMount
					>
						<ScrollArea className="h-full w-full">
							<div className="px-3 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-5">
								{renderLogContent(
									stderrQuery.data,
									stderrQuery.isPending || stderrQuery.isFetching,
									stderrQuery.isError,
									stderrQuery.error,
									() => void stderrQuery.refetch(),
									"No log available.",
								)}
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent
						value="test"
						className="min-h-0 flex-1 overflow-hidden"
						forceMount
					>
						<ScrollArea className="h-full w-full">
							<div className="px-3 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-5">
								{renderLogContent(
									verifierQuery.data,
									verifierQuery.isPending || verifierQuery.isFetching,
									verifierQuery.isError,
									verifierQuery.error,
									() => void verifierQuery.refetch(),
									"No test log available.",
								)}
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent
						value="browser-verification"
						className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
						forceMount
					>
						{browserVerificationUrls.length === 0 ? (
							<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
								No browser verification trajectory available.
							</div>
						) : (
							<>
								<div className="border-border/40 border-b bg-muted/20 px-4 py-2 sm:px-5">
									<div className="custom-scrollbar flex min-w-max gap-1.5 overflow-x-auto py-1">
										{browserVerificationUrls.map((testCase) => (
											<button
												key={testCase.name}
												type="button"
												onClick={() =>
													setActiveBrowserVerificationTab(testCase.name)
												}
												className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 font-medium text-[11px] transition-all duration-200 sm:text-xs ${
													activeBrowserVerificationTab === testCase.name
														? "border-primary/30 bg-primary/10 text-primary shadow-xs"
														: "border-border/40 bg-background/50 text-muted-foreground hover:border-border/80 hover:bg-background hover:text-foreground"
												}`}
											>
												<span className="flex items-center gap-1.5">
													<span
														className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
															activeBrowserVerificationTab === testCase.name
																? "scale-110 bg-primary shadow-[0_0_8px_var(--primary)]"
																: "bg-muted-foreground/40"
														}`}
													/>
													{testCase.name}
												</span>
											</button>
										))}
									</div>
								</div>
								<div className="relative min-h-0 flex-1">
									<div
										className={`absolute inset-0 z-10 overflow-auto bg-background/80 transition-opacity delay-220 duration-420 ease-out ${
											!mounted ||
											browserIframeLoading[activeBrowserVerificationTab]
												? "opacity-100"
												: "pointer-events-none opacity-0"
										}`}
									>
										<TrajectorySkeleton />
									</div>
									{mounted && activeBrowserVerificationUrl && (
										<iframe
											key={activeBrowserVerificationTab}
											src={activeBrowserVerificationUrl}
											className={`h-full w-full border-0 transition-opacity duration-260 ease-out ${
												browserIframeLoading[activeBrowserVerificationTab]
													? "opacity-0"
													: "opacity-100"
											}`}
											title={`Browser Verification - ${activeBrowserVerificationTab}`}
											onLoad={() =>
												handleBrowserIframeLoad(activeBrowserVerificationTab)
											}
											onError={handleIframeError}
										/>
									)}
								</div>
							</>
						)}
					</TabsContent>

					{devModeEnabled && artifactTree && artifactTree.length > 0 && (
						<TabsContent
							value="artifacts"
							className="min-h-0 flex-1 overflow-hidden"
							forceMount
						>
							<ArtifactsPanel artifactTree={artifactTree} />
						</TabsContent>
					)}
				</Tabs>
			</div>
		</div>
	);
}

export function LogErrorView({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="rounded-md border border-red-200 bg-red-50 px-4 py-5 dark:border-red-500/30 dark:bg-red-500/5">
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-red-700 text-sm dark:text-red-300">{message}</p>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="cursor-pointer"
					onClick={onRetry}
				>
					Retry
				</Button>
			</div>
		</div>
	);
}

export function LogContentSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-[90%]" />
			<Skeleton className="h-4 w-[70%]" />
			<Skeleton className="h-4 w-[85%]" />
			<Skeleton className="h-4 w-[60%]" />
			<Skeleton className="h-4 w-[55%]" />
		</div>
	);
}

function TrajectorySkeleton() {
	return (
		<div className="animate-pulse space-y-2 p-4">
			<div className="flex items-center space-x-3">
				<Skeleton className="size-6 rounded-full" />
				<Skeleton className="h-4 w-16" />
			</div>
			<div className="space-y-2 pt-1">
				<Skeleton className="h-4 w-[80%]" />
				<Skeleton className="h-4 w-[50%]" />
			</div>
			<div className="mt-8 flex items-center space-x-3">
				<div className="flex items-center space-x-3">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="h-4 w-16" />
				</div>
			</div>
			<div className="space-y-2 pt-1">
				<Skeleton className="h-4 w-[80%]" />
				<Skeleton className="h-4 w-[80%]" />
				<Skeleton className="h-4 w-[50%]" />
			</div>
		</div>
	);
}

export function getLogErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Something went wrong. Please try again.";
	}

	if (error.status === 404) {
		return "Log not found.";
	}

	if (error.status === 429) {
		return "Request rate limit exceeded. Please retry shortly.";
	}

	if (typeof error.status === "number" && error.status >= 500) {
		return "Server error while loading logs.";
	}

	return error.message || "Something went wrong. Please try again.";
}
