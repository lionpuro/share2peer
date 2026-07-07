import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconSettings, Logo } from "#/components/icons";
import { SettingsDialog } from "#/components/settings";

export function Header() {
	const [settingsOpen, setSettingsOpen] = useState(false);
	return (
		<header className="mx-auto flex w-full items-center px-6 py-3">
			<Link to="/" className="flex items-center gap-1 text-xl font-semibold">
				<Logo className="size-6.5 text-primary" />
				Websend
			</Link>
			<button
				title="Settings"
				onClick={() => setSettingsOpen(true)}
				className="ml-auto flex size-8 items-center justify-center text-lg text-muted-foreground/80 hover:text-muted-foreground"
			>
				<IconSettings />
			</button>
			<SettingsDialog
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
			/>
		</header>
	);
}
