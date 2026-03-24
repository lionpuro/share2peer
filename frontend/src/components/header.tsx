import { useContext } from "react";
import { Link } from "@tanstack/react-router";
import { IconMoon, IconSun, Logo } from "#/components/icons";
import { ThemeContext } from "#/context/theme/context";

export function Header() {
	const { theme, setTheme } = useContext(ThemeContext);
	const altTheme = theme === "light" ? "dark" : "light";
	return (
		<header className="mx-auto flex w-full max-w-screen-lg items-center px-6 py-3 sm:px-8">
			<Link to="/" className="flex items-center gap-1 text-lg font-semibold">
				<Logo className="size-6.5 text-primary" />
				WebSend
			</Link>
			<button
				onClick={() => setTheme(altTheme)}
				title={`Switch to ${altTheme} theme`}
				className="ml-auto text-lg text-muted-foreground/80 hover:text-muted-foreground"
			>
				{theme === "light" ? <IconMoon /> : <IconSun />}
			</button>
		</header>
	);
}
