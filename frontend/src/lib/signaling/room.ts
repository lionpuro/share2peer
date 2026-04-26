import { setUploads } from "#/stores/file";
import { $room } from "#/stores/signaling";
import type { Room, User } from "#/lib/schemas";
import {
	createPeerConnection,
	findConnection,
	removeConnection,
	removeConnections,
} from "#/lib/webrtc";
import type { SignalingServer } from "#/lib/signaling/server";

type RoomState = "idle" | "joining" | "active" | "failed";

let state: RoomState = "idle";

export function roomState() {
	return state;
}

export async function joinRoom(
	server: SignalingServer,
	id: string,
): Promise<Room> {
	if (state === "joining") {
		throw new Error("already joining a room");
	}

	await leaveRoom(server);

	state = "joining";

	try {
		const resp = await server.request({
			type: "join-room",
			payload: { room_id: id },
		});
		switch (resp.type) {
			case "room-joined":
				state = "active";
				$room.set(resp.payload);
				return resp.payload;
			default:
				throw new Error("Failed to join room");
		}
	} catch (err) {
		state = "failed";
		throw err;
	}
}

export async function leaveRoom(server: SignalingServer) {
	const room = $room.get();
	if (
		!room ||
		(server.state !== "connected" && server.state !== "connecting")
	) {
		return;
	}
	try {
		await server
			.request({
				type: "leave-room",
				payload: { room_id: room.id },
			})
			.catch(console.error);
		handleRoomLeft();
	} catch (err) {
		console.error("leave room:", err);
	}
}

export async function createRoom(server: SignalingServer): Promise<Room> {
	state = "idle";
	await leaveRoom(server);
	const resp = await server.request({
		type: "create-room",
	});
	switch (resp.type) {
		case "room-created":
			return resp.payload;
		default:
			state = "failed";
			throw new Error("Failed to create room");
	}
}

export function handleRoomInfo(room: Room) {
	$room.set(room);
}

export function handleRoomLeft() {
	$room.set(undefined);
	state = "idle";
	removeConnections();
	setUploads([]);
}

export async function handleUserJoined(server: SignalingServer, user: User) {
	if (findConnection(user.id)) return;
	const room = $room.get();
	if (!room) return;
	await createPeerConnection(server, room.id, user);
}

export function handleUserLeft(user: User) {
	removeConnection(user.id);
}

export function closeRoom() {
	$room.set(undefined);
	state = "idle";
}
