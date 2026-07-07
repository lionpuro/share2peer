import { useContext } from "react";
import { ThemeContext } from "#/context/theme/context";
import { IconMoon, IconSun, IconX } from "#/components/icons";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { Heading } from "#/components/ui/heading";
import { cn, toTitleCase } from "#/lib/helper";

export function SettingsDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	return (
		<Dialog open={open} onClose={onClose}>
			<DialogContent>
				<button
					title="Close"
					onClick={onClose}
					className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
				>
					<IconX />
				</button>
				<Heading order={2} className="mb-6 focus:outline-none">
					Settings
				</Heading>
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-y-2">
						<Heading order={3}>Theme</Heading>
						<ThemeSwitch />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

const themes = [
	{ key: "light", icon: IconSun, label: "Light theme" },
	{ key: "dark", icon: IconMoon, label: "Dark theme" },
] as const;

function ThemeSwitch() {
	const { theme, setTheme } = useContext(ThemeContext);
	return (
		<div className="flex gap-1 overflow-hidden rounded-lg bg-secondary p-0.5 dark:bg-background">
			{themes.map((opt) => (
				<button
					key={opt.key + "theme"}
					title={`Switch to ${opt.label.toLowerCase()}`}
					onClick={() => setTheme(opt.key)}
					className={cn(
						"flex min-w-21 items-center justify-center gap-1.5 rounded-md py-0.5 pr-0.75",
						theme === opt.key
							? "bg-background text-foreground dark:bg-secondary/50"
							: "text-muted-foreground",
					)}
				>
					<opt.icon />
					{toTitleCase(opt.key)}
				</button>
			))}
		</div>
	);
}
