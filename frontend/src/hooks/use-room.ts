import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { RoomManager } from "#/lib/room";
import { $room } from "#/stores/signaling";

const manager = new RoomManager(server);

const create = () => manager.create();

export function useRoom() {
	const room = useStore($room);

	return {
		room,
		createRoom: create,
	};
}

export function useJoinRoom(id: string) {
	const room = useStore($room);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (room || manager.state === "active" || manager.state === "joining")
			return;
		manager.join(id).catch((err) => {
			console.error(err);
			if (err instanceof Error) {
				setError(err.message);
			}
		});
	}, [id, room]);

	useEffect(() => {
		return () => {
			if (manager.state === "active") {
				manager.leave();
			}
		};
	}, []);

	return {
		error,
	};
}
