import { useEffect, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeKey } from "./context";

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<ThemeKey>(() => {
		const value = localStorage.getItem("theme");
		if (value !== "light" && value !== "dark") {
			const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			return dark ? "dark" : "light";
		}
		return value;
	});

	useEffect(() => {
		const html = document.documentElement;
		if (theme === "light") {
			html.classList.remove("dark");
		}
		if (theme === "dark") {
			html.classList.add(theme);
		}
		localStorage.setItem("theme", theme);
	}, [theme]);

	return (
		<ThemeContext.Provider value={{ theme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
