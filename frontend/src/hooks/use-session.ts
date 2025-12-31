import { useStore } from "@nanostores/react";
import { socket } from "#/lib/socket";
import {
	$session,
	joinSession,
	leaveSession,
	requestSession,
} from "#/lib/session";

export function useSession() {
	const session = useStore($session);

	return {
		session,
		requestSession: () => requestSession(socket),
		joinSession: (id: string) => joinSession(socket, id),
		leaveSession: (id: string) => leaveSession(socket, id),
	};
}
