import { useStore } from "@nanostores/react";
import { atom } from "nanostores";
import { socket } from "./socket";
import { MessageType } from "./message";

export type Client = {
	id: string;
};

export type Session = {
	id: string;
	clients?: Client[];
};

export const $session = atom<Session | null>(null);

function joinSession(id: string) {
	socket.send({
		type: MessageType.JoinSession,
		payload: { session_id: id },
	});
}

function leaveSession(id: string) {
	socket.send({
		type: MessageType.LeaveSession,
		payload: { session_id: id },
	});
}

function requestSession() {
	socket.send({ type: MessageType.RequestSession });
}

export function useSession() {
	const session = useStore($session);

	return { session, requestSession, joinSession, leaveSession };
}
