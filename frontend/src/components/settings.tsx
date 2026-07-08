import { useContext } from "react";
import { useStore } from "@nanostores/react";
import { $settings, setSettings } from "#/stores/settings";
import { ThemeContext } from "#/context/theme/context";
import { useSignalingClient } from "#/hooks/use-signaling-client";
import { IconMonitor, IconMoon, IconSun, IconX } from "#/components/icons";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { Heading } from "#/components/ui/heading";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/helper";

export function SettingsDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const client = useSignalingClient();
	const settings = useStore($settings);

	function updateDiscoverable(v: boolean) {
		const updated = { ...settings, discoverable: v };
		setSettings(updated);
		if (client.state === "connected") {
			client
				.send({ type: "settings", payload: updated })
				.catch((err) => console.error("update settings:", err));
		}
	}

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
					<div className="flex flex-wrap items-center gap-y-1">
						<Heading order={3}>Discoverable</Heading>
						<Switch
							id="pref-discoverable"
							checked={settings.discoverable}
							onChange={(e) => updateDiscoverable(e.target.checked)}
							className="ml-auto"
						/>
						<p className="w-full text-sm text-muted-foreground">
							Allow other devices on your network to discover this device
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

const themes = [
	{ key: "light", icon: IconSun, label: "Light" },
	{ key: "dark", icon: IconMoon, label: "Dark" },
	{ key: "system", icon: IconMonitor, label: "Auto" },
] as const;

function ThemeSwitch() {
	const { theme, setTheme } = useContext(ThemeContext);
	return (
		<div className="flex gap-1 overflow-hidden rounded-lg bg-secondary p-0.5 dark:bg-background">
			{themes.map((opt) => (
				<button
					key={opt.key + "theme"}
					title={`Switch to ${opt.key} theme`}
					onClick={() => setTheme(opt.key)}
					className={cn(
						"flex min-w-21 items-center justify-center gap-1.5 rounded-md py-0.5 pr-0.75",
						theme === opt.key
							? "bg-background text-foreground dark:bg-secondary/50"
							: "text-muted-foreground",
					)}
				>
					<opt.icon />
					{opt.label}
				</button>
			))}
		</div>
	);
}
