import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackToLeaderboardProps {
  className?: string;
}

export function BackToLeaderboard({ className }: BackToLeaderboardProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back to Leaderboard</span>
    </Link>
  );
}
