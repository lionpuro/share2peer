import { setUploads } from "#/stores/file";
import { $room } from "#/stores/signaling";
import type { Room, User } from "#/lib/schemas";
import {
	createPeerConnection,
	findConnection,
	removeConnection,
	removeConnections,
} from "#/lib/webrtc";
import type { SignalingClient } from "#/lib/signaling/client";

type RoomState = "idle" | "joining" | "active" | "failed";

let state: RoomState = "idle";

export function roomState() {
	return state;
}

export async function joinRoom(
	client: SignalingClient,
	id: string,
): Promise<Room> {
	if (state === "joining") {
		throw new Error("already joining a room");
	}

	await leaveRoom(client);

	state = "joining";

	try {
		const resp = await client.request({
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

export async function leaveRoom(client: SignalingClient) {
	const room = $room.get();
	if (
		!room ||
		(client.state !== "connected" && client.state !== "connecting")
	) {
		return;
	}
	try {
		await client
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

export async function createRoom(client: SignalingClient): Promise<Room> {
	state = "idle";
	await leaveRoom(client);
	const resp = await client.request({
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

export async function handleUserJoined(client: SignalingClient, user: User) {
	if (findConnection(user.id)) return;
	const room = $room.get();
	if (!room) return;
	await createPeerConnection(client, room.id, user);
}

export function handleUserLeft(user: User) {
	removeConnection(user.id);
}

export function closeRoom() {
	$room.set(undefined);
	state = "idle";
}
