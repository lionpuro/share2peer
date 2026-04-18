import { useContext } from "react";
import { Link } from "@tanstack/react-router";
import { IconMonitor, IconMoon, IconSun, Logo } from "#/components/icons";
import { ThemeContext } from "#/context/theme/context";
import { cn } from "#/lib/helper";

export function Header() {
	return (
		<header className="mx-auto flex w-full items-center px-6 py-3 sm:px-8">
			<Link to="/" className="flex items-center gap-1 text-xl font-semibold">
				<Logo className="size-6.5 text-primary" />
				Websend
			</Link>
			<ThemeSwitch />
		</header>
	);
}

const themes = [
	{ key: "system", icon: IconMonitor, label: "System theme" },
	{ key: "light", icon: IconSun, label: "Light theme" },
	{ key: "dark", icon: IconMoon, label: "Dark theme" },
] as const;

function ThemeSwitch() {
	const { theme, setTheme } = useContext(ThemeContext);
	return (
		<div className="ml-auto flex">
			{themes.map((opt) => (
				<button
					key={opt.key}
					title={opt.label}
					popoverTarget="theme-dropdown"
					popoverTargetAction="hide"
					onClick={() => setTheme(opt.key)}
					className={cn(
						"flex h-8.5 w-8 items-center justify-center",
						theme === opt.key ? "text-primary" : "hover:text-muted-foreground",
					)}
				>
					<opt.icon className="size-4" />
				</button>
			))}
		</div>
	);
}
