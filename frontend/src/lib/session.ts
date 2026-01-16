import { atom } from "nanostores";
import type { WebSocketManager } from "./socket";
import type { Session } from "./schemas";

export const $session = atom<Session | null>(null);

export const $availableSession = atom<string | null>(null);

export function joinSession(socket: WebSocketManager, id: string) {
	socket.send({
		type: "join-session",
		payload: { session_id: id },
	});
}

export function leaveSession(socket: WebSocketManager, id: string) {
	socket.send({
		type: "leave-session",
		payload: { session_id: id },
	});
}

export function requestSession(socket: WebSocketManager) {
	socket.send({ type: "request-session" });
}
