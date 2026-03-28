import { createContext } from "react";

export type ThemeKey = "system" | "light" | "dark";

type ThemeContextValue = {
	theme: ThemeKey;
	setTheme: (v: ThemeKey) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
	theme: "system",
	setTheme: () => {},
});

export function getSystemTheme() {
	const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	return dark ? "dark" : "light";
}
