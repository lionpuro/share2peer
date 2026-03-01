import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { RoomManager } from "#/lib/room";
import { $room } from "#/stores/signaling";

const manager = new RoomManager(server);

const join = (id: string) => manager.join(id);
const leave = () => manager.leave();
const create = () => manager.create();

export function useRoom(id?: string) {
	const room = useStore($room);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (!id) return;
		if (room && room.id === id) return;
		if (manager.state === "active" || manager.state === "joining") {
			return;
		}

		manager.join(id).catch((err) => {
			console.error(err);
			if (err instanceof Error) {
				setError(err.message);
				return;
			}
		});
	}, [id, room]);

	return {
		room,
		error,
		joinRoom: join,
		leaveRoom: leave,
		createRoom: create,
	};
}
