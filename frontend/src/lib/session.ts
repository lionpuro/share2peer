import { atom } from "nanostores";
import * as z from "zod/mini";
import { socket } from "./socket";
import { MessageType } from "./message";
import { ClientSchema } from "./client";

export const SessionSchema = z.object({
	id: z.string(),
	clients: z.optional(z.array(ClientSchema)),
});

export type Session = z.infer<typeof SessionSchema>;

export const $session = atom<Session | null>(null);

export function joinSession(id: string) {
	socket.send({
		type: MessageType.JoinSession,
		payload: { session_id: id },
	});
}

export function leaveSession(id: string) {
	socket.send({
		type: MessageType.LeaveSession,
		payload: { session_id: id },
	});
}

export function requestSession() {
	socket.send({ type: MessageType.RequestSession });
}
