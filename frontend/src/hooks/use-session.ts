import { useStore } from "@nanostores/react";
import { socket } from "#/lib/socket";
import {
	$session,
	joinSession,
	leaveSession,
	requestSession,
} from "#/lib/session";
import { useEffect } from "react";
import { useSocket } from "./use-socket";

const request = () => requestSession(socket);
const join = (id: string) => joinSession(socket, id);
const leave = (id: string) => leaveSession(socket, id);

export function useSession(id?: string) {
	const { connectionState } = useSocket();
	const session = useStore($session);

	useEffect(() => {
		if (connectionState !== "open") {
			return;
		}
		if (id === session?.id) {
			return;
		}
		if (id && session?.id !== id) {
			join(id);
		}
		if (session && !id) {
			leave(session.id);
		}
	}, [id, connectionState, session]);

	return {
		session,
		requestSession: request,
		joinSession: join,
		leaveSession: leave,
	};
}
