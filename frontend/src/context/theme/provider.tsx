import { useEffect, useState, type ReactNode } from "react";
import { getSystemTheme, ThemeContext, type ThemeKey } from "./context";

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
		const value = localStorage.getItem("theme");
		if (value !== "light" && value !== "dark") {
			return "system";
		}
		return value;
	});

	useEffect(() => {
		const html = document.documentElement;
		const theme = themeKey === "system" ? getSystemTheme() : themeKey;
		if (theme === "light") {
			html.classList.remove("dark");
		}
		if (theme === "dark") {
			html.classList.add(theme);
		}
		localStorage.setItem("theme", themeKey);
	}, [themeKey]);

	return (
		<ThemeContext.Provider value={{ theme: themeKey, setTheme: setThemeKey }}>
			{children}
		</ThemeContext.Provider>
	);
}
