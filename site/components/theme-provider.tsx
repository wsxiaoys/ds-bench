"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

export function ThemeProvider({
	children,
	defaultTheme = "dark",
}: {
	children: ReactNode;
	defaultTheme?: ThemeMode;
}) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme={defaultTheme}
			enableSystem
			// Keep iframe transparency rendering stable across theme switches.
			enableColorScheme={false}
			disableTransitionOnChange
		>
			{children}
		</NextThemesProvider>
	);
}
