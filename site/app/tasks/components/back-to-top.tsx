"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTop() {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const toggleVisibility = () => {
			if (window.scrollY > 300) {
				setIsVisible(true);
			} else {
				setIsVisible(false);
			}
		};

		window.addEventListener("scroll", toggleVisibility);
		return () => window.removeEventListener("scroll", toggleVisibility);
	}, []);

	const scrollToTop = () => {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	};

	if (!isVisible) return null;

	return (
		<button
			type="button"
			onClick={scrollToTop}
			className="group fixed right-8 bottom-8 z-50 flex items-center justify-center rounded-full border border-border bg-secondary p-3 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-secondary/80"
			aria-label="Back to top"
		>
			<ArrowUp className="h-5 w-5 transition-transform group-hover:-translate-y-1" />
		</button>
	);
}
