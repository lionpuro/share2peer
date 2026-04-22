import { createContext } from "react";

export type ThemeKey = "light" | "dark";

type ThemeContextValue = {
	theme: ThemeKey;
	setTheme: (v: ThemeKey) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
	theme: window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light",
	setTheme: () => {},
});
