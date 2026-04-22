import { useContext } from "react";
import { Link } from "@tanstack/react-router";
import { IconMoon, IconSun, Logo } from "#/components/icons";
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
	{ key: "light", icon: IconSun, label: "Light theme" },
	{ key: "dark", icon: IconMoon, label: "Dark theme" },
] as const;

function ThemeSwitch() {
	const { theme, setTheme } = useContext(ThemeContext);
	return (
		<div className="ml-auto flex">
			{themes.map((opt) =>
				theme === opt.key ? null : (
					<button
						key={opt.key}
						title={opt.label}
						popoverTarget="theme-dropdown"
						popoverTargetAction="hide"
						onClick={() => setTheme(opt.key)}
						className={cn(
							"flex size-8 items-center justify-center hover:text-muted-foreground",
						)}
					>
						<opt.icon className="size-5" />
					</button>
				),
			)}
		</div>
	);
}
