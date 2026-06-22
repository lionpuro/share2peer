import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function toTitleCase(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const formattedSize = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
	return `${formattedSize} ${units[i]}`;
}

export function calcProgress(current: number, total: number): number {
	const progress = (current / total) * 100;
	return Math.round(progress);
}
