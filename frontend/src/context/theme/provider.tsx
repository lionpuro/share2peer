import { useEffect, useState, type ReactNode } from "react";
import { getPreferredTheme, ThemeContext, type ThemeOption } from "./context";

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<ThemeOption>(() => {
		const value = localStorage.getItem("theme");
		if (value !== "light" && value !== "dark") {
			return "system";
		}
		return value;
	});

	useEffect(() => {
		const html = document.documentElement;
		const colorScheme = theme === "system" ? getPreferredTheme() : theme;
		if (colorScheme === "light") {
			html.classList.remove("dark");
		}
		if (colorScheme === "dark") {
			html.classList.add("dark");
		}
		localStorage.setItem("theme", theme);
	}, [theme]);

	return (
		<ThemeContext.Provider value={{ theme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
