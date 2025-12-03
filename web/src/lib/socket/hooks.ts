import { useStore } from "@nanostores/react";
import { useNavigate } from "@tanstack/react-router";
import { $isConnected, socket } from "./socket";
import { useCallback, useEffect } from "react";
import { type MessageEventListener, MessageType } from "../message";

export function useSocket() {
	const navigate = useNavigate();
	const connected = useStore($isConnected);

	const handleCreated: MessageEventListener<typeof MessageType.SessionCreated> =
		useCallback(
			(e) => {
				const msg = e.detail;
				navigate({ to: "/s/$code", params: { code: msg.payload.session_id } });
			},
			[navigate],
		);

	useEffect(() => {
		socket.addEventListener(MessageType.SessionCreated, handleCreated);
		return () => {
			socket.addEventListener(MessageType.SessionCreated, handleCreated);
		};
	}, [handleCreated]);

	return {
		connected: connected,
		socket: socket,
	};
}
