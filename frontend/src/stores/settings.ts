import { map } from "nanostores";
import * as z from "zod/mini";

const settingsSchema = z.object({
	discoverable: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const $settings = map<Settings>(getStoredSettings());

export function setSettings(v: Settings) {
	localStorage.setItem("settings", JSON.stringify(v));
	$settings.set({ ...v });
}

function getStoredSettings(): Settings {
	const stored = localStorage.getItem("settings");
	try {
		if (!stored) {
			throw new Error("no stored settings");
		}
		const settings = settingsSchema.parse(JSON.parse(stored));
		return settings;
	} catch {
		return { discoverable: true };
	}
}
