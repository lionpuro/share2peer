import { createContext } from "react";

type ThemeContextValue = {
	theme: "light" | "dark";
	setTheme: (v: "light" | "dark") => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
	theme: "light",
	setTheme: () => {},
});
