import { $room } from "#/stores/signaling";
import { parseBody, type Room, type User } from "./schemas";
import { SignalingServer } from "./server";
import {
	createPeerConnection,
	findConnection,
	removeConnection,
	removeConnections,
} from "./webrtc";

type RoomState = "idle" | "joining" | "active" | "failed";

let state: RoomState = "idle";

export function roomState() {
	return state;
}

export async function joinRoom(server: SignalingServer, id: string) {
	if (state === "joining" || state === "active") {
		throw new Error("already joining a room");
	}
	state = "joining";
	const response = await server.sendRequest({
		type: "join-room",
		payload: { room_id: id },
	});
	const body = parseBody(response.body);
	switch (body.type) {
		case "room-joined":
			state = "active";
			$room.set(body.payload);
			return body.payload;
		case "error":
			state = "failed";
			throw new Error(body.payload.message);
		default:
			state = "failed";
			throw new Error("Failed to join room");
	}
}

export async function leaveRoom(server: SignalingServer) {
	const room = $room.get();
	if (!room) return;
	try {
		await server
			.sendRequest({
				type: "leave-room",
				payload: { room_id: room.id },
			})
			.catch(console.error);
		state = "idle";
		$room.set(undefined);
		removeConnections();
	} catch (err) {
		console.error("leave room:", err);
	}
}

export async function createRoom(server: SignalingServer): Promise<Room> {
	state = "idle";
	const room = $room.get();
	if (room) {
		await leaveRoom(server);
	}
	const response = await server.sendRequest({
		type: "create-room",
	});
	const body = parseBody(response.body);
	switch (body.type) {
		case "room-created":
			return body.payload;
		case "error":
			state = "failed";
			throw new Error(body.payload.message);
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
