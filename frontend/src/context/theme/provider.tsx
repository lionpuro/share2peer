import { useEffect, useState, type ReactNode } from "react";
import { ThemeContext } from "./context";

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<"light" | "dark">(() => {
		const value = localStorage.getItem("theme");
		if (value !== "light" && value !== "dark") {
			const dark = window.matchMedia("(prefers-color-scheme: dark)");
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
