import { atom } from "nanostores";
import * as z from "zod/mini";
import type { WebSocketManager } from "./socket";
import { ClientSchema } from "./client";

export const SessionSchema = z.object({
	id: z.string(),
	clients: z.optional(z.array(ClientSchema)),
});

export type Session = z.infer<typeof SessionSchema>;

export const $session = atom<Session | null>(null);

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
