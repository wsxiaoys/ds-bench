import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BackToLeaderboardProps {
	className?: string;
}

export function BackToLeaderboard({ className }: BackToLeaderboardProps) {
	return (
		<Link
			href="/"
			className={cn(
				"inline-flex items-center gap-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
				className,
			)}
		>
			<ArrowLeft className="h-4 w-4" />
			<span>Back to Leaderboard</span>
		</Link>
	);
}
