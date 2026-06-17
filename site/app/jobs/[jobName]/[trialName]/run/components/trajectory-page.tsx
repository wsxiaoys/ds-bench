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
import { type ArtifactNodeWithUrl, ArtifactsPanel } from "./artifacts-panel";

export type TabConfig = {
	value: string;
	label: React.ReactNode;
};

type TrajectoryPageProps = {
	trajectoryUrl: string;
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
		const url = new URL(trajectoryUrl);
		const hashParams = new URLSearchParams(url.hash.slice(1));
		hashParams.set("theme", iframeTheme);
		url.hash = hashParams.toString();
		return url.toString();
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

		return (
			<pre className="w-max min-w-full whitespace-pre font-mono text-foreground/95 text-xs leading-5">
				{text}
			</pre>
		);
	};

	return (
		<div className="h-full w-full pt-4 pb-4 sm:pt-5 sm:pb-6">
			<div className="mx-auto h-full w-full max-w-350 px-4 sm:px-7 lg:px-10">
				<Tabs
					value={activeTab}
					onValueChange={handleTabChange}
					className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-border bg-background/70 shadow-sm backdrop-blur-sm"
				>
					<div className="border-border border-b bg-background/40 px-3 py-3 sm:px-4">
						<TabsList
							className={`flex h-11 w-full ${
								visibleTabsConfig.length <= 3 ? "sm:w-120" : "sm:w-160"
							} max-w-full items-stretch gap-1 rounded-lg bg-muted/55 p-1`}
						>
							{visibleTabsConfig.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="h-full flex-1 cursor-pointer rounded-md border-0 py-0 text-muted-foreground leading-none transition-colors hover:bg-primary/10 hover:text-foreground data-[state=active]:bg-primary/18 data-[state=active]:text-foreground data-[state=active]:shadow-none"
								>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					<TabsContent
						value="trajectory"
						className="relative min-h-0 flex-1 overflow-hidden"
						forceMount
					>
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
								<div className="mt-3 shrink-0 overflow-x-auto bg-background/20 px-3 py-1.5 sm:px-4">
									<div className="flex min-w-max gap-1.5">
										{browserVerificationUrls.map((testCase) => (
											<button
												key={testCase.name}
												type="button"
												onClick={() =>
													setActiveBrowserVerificationTab(testCase.name)
												}
												className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition-colors sm:text-xs ${
													activeBrowserVerificationTab === testCase.name
														? "border-primary/20 bg-primary/10 font-medium text-primary"
														: "border-transparent bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
												}`}
											>
												{testCase.name}
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
