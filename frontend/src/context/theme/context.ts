import { createContext } from "react";

export type ThemeOption = "system" | "light" | "dark";

type ThemeContextValue = {
	theme: ThemeOption;
	setTheme: (v: ThemeOption) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
	theme: "system",
	setTheme: () => {},
});

export function getPreferredTheme() {
	const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	return dark ? "dark" : "light";
}
