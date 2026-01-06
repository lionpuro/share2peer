import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { socket } from "#/lib/socket";
import {
	$session,
	joinSession,
	leaveSession,
	requestSession,
} from "#/lib/session";
import { useSocket } from "./use-socket";
import type { MessageEventMap } from "#/lib/message";
import type { ErrorPayload } from "#/lib/errors";

const request = () => requestSession(socket);
const join = (id: string) => joinSession(socket, id);
const leave = (id: string) => leaveSession(socket, id);

export function useSession(id?: string) {
	const { connectionState } = useSocket();
	const session = useStore($session);
	const [error, setError] = useState<ErrorPayload | undefined>();

	const handleError = (e: MessageEventMap["error"]) => {
		const err = e.detail.payload;
		if (err.code === "SESSION_NOT_FOUND") {
			setError(err);
		}
	};

	useEffect(() => {
		if (connectionState !== "open") {
			return;
		}
		if (id === session?.id) {
			return;
		}
		if (id && session?.id !== id) {
			socket.addEventListener("error", handleError);
			join(id);
			return () => {
				socket.removeEventListener("error", handleError);
				setError(undefined);
			};
		}
	}, [id, connectionState, session]);

	return {
		session,
		error,
		requestSession: request,
		joinSession: join,
		leaveSession: leave,
	};
}
