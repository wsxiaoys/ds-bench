"use client";

import { type ClassValue, clsx } from "clsx";
import { ChevronsUpDown } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function MultiSelect({
	title,
	options,
	selected,
	onChange,
	className,
}: {
	title: string;
	options: string[];
	selected: string[];
	onChange: (vals: string[]) => void;
	className?: string;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex h-9 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				>
					<div className="flex items-center gap-1 overflow-hidden">
						<span className="mr-1 whitespace-nowrap text-muted-foreground">
							{title}
						</span>
						{selected.length === 0 && (
							<Badge
								variant="secondary"
								className="shrink-0 rounded-sm px-1 font-normal"
							>
								All
							</Badge>
						)}
						{selected.length > 0 &&
							selected.length <= 2 &&
							selected.map((s) => (
								<Badge
									variant="secondary"
									key={s}
									className="max-w-[120px] overflow-hidden rounded-sm px-1 font-normal"
								>
									<span className="truncate">{s}</span>
								</Badge>
							))}
						{selected.length > 2 && (
							<Badge
								variant="secondary"
								className="shrink-0 rounded-sm px-1 font-normal"
							>
								{selected.length} selected
							</Badge>
						)}
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0" align="start">
				<Command>
					<CommandInput placeholder={`Search ${title}...`} />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup>
							<CommandItem onSelect={() => onChange([])}>
								<Checkbox
									checked={selected.length === 0}
									className="mr-2"
									onCheckedChange={() => {}}
								/>
								<span>All</span>
							</CommandItem>
							{options.map((option) => {
								const isSelected = selected.includes(option);
								return (
									<CommandItem
										key={option}
										onSelect={() => {
											if (isSelected) {
												onChange(selected.filter((s) => s !== option));
											} else {
												onChange([...selected, option]);
											}
										}}
									>
										<Checkbox
											checked={isSelected}
											className="mr-2"
											onCheckedChange={() => {}}
										/>
										<span>{option}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
