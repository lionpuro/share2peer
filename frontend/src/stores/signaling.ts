import { atom } from "nanostores";
import type { User, Room } from "#/lib/schemas";

export type SocketState =
	| "disconnected"
	| "connecting"
	| "connected"
	| "failed";

export const $connectionState = atom<SocketState>("disconnected");

export const $identity = atom<User | undefined>();

export const $networkUsers = atom<User[]>([]);

export const $room = atom<Room | undefined>();

type SessionData = {
	username: string;
};

const SESSION_KEY = "SESSION_DATA";

export function setSessionData(val: SessionData | undefined) {
	if (!val) {
		sessionStorage.removeItem(SESSION_KEY);
		return;
	}
	sessionStorage.setItem(SESSION_KEY, JSON.stringify(val));
}

export function getSessionData(): SessionData | undefined {
	const val = sessionStorage.getItem(SESSION_KEY);
	if (!val) {
		return undefined;
	}

	try {
		const v: unknown = JSON.parse(val);
		if (
			v === null ||
			typeof v !== "object" ||
			!("username" in v) ||
			typeof v.username !== "string"
		) {
			throw new Error("malformed session data");
		}
		return { username: v.username };
	} catch {
		sessionStorage.removeItem(SESSION_KEY);
		return undefined;
	}
}
