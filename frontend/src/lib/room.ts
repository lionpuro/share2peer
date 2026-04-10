import { setUploads } from "#/stores/file";
import { $room } from "#/stores/signaling";
import { parseMessage, type Room, type User } from "./schemas";
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

export async function joinRoom(
	server: SignalingServer,
	id: string,
): Promise<Room> {
	if (state === "joining") {
		throw new Error("already joining a room");
	}

	await leaveRoom(server);

	state = "joining";
	const response = await server.sendRequest({
		type: "join-room",
		payload: { room_id: id },
	});
	const message = parseMessage(response);
	switch (message.type) {
		case "room-joined":
			state = "active";
			$room.set(message.payload);
			return message.payload;
		case "error":
			state = "failed";
			throw new Error(message.payload.message);
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
		handleRoomLeft();
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
	const message = parseMessage(response);
	switch (message.type) {
		case "room-created":
			return message.payload;
		case "error":
			state = "failed";
			throw new Error(message.payload.message);
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
