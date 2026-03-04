import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { joinRoom, leaveRoom, roomState } from "#/lib/room";
import { $room } from "#/stores/signaling";

export function useRoom() {
	const room = useStore($room);
	return { room };
}

export function useJoinRoom(id: string) {
	const room = useStore($room);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		const state = roomState();
		if (room || state === "active" || state === "joining") {
			return;
		}
		joinRoom(server, id).catch((err) => {
			console.error(err);
			if (err instanceof Error) {
				setError(err.message);
			}
		});
	}, [id, room]);

	useEffect(() => {
		return () => {
			if (roomState() === "active") {
				leaveRoom(server);
			}
		};
	}, []);

	return {
		error,
	};
}
