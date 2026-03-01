import { $room } from "#/stores/signaling";
import { parseBody, type Room } from "./schemas";
import type { SignalingServer } from "./server";
import {
	createPeerConnection,
	findConnection,
	removeConnection,
	removeConnections,
} from "./webrtc";

type RoomState = "idle" | "joining" | "active" | "failed";

export class RoomManager {
	#server: SignalingServer;
	state: RoomState = "idle";

	constructor(server: SignalingServer) {
		this.#server = server;
		this.#server.addEventListener("close", () => {
			$room.set(undefined);
			this.state = "idle";
		});
		this.#server.addEventListener("room-info", (e) => {
			$room.set(e.detail);
		});
		this.#server.addEventListener("room-left", () => {
			$room.set(undefined);
			this.state = "idle";
			removeConnections();
		});
		this.#server.addEventListener("client-joined", async (e) => {
			const id = e.detail.id;
			if (findConnection(id)) return;
			const room = $room.get();
			if (!room) return;
			await createPeerConnection(this.#server, room.id, e.detail);
		});
		this.#server.addEventListener("client-left", (e) => {
			removeConnection(e.detail.id);
		});
	}

	async join(id: string): Promise<Room> {
		if (this.state === "joining" || this.state === "active") {
			throw new Error("already joining a room");
		}
		this.state = "joining";
		const response = await this.#server.sendRequest({
			type: "join-room",
			payload: { room_id: id },
		});
		const body = parseBody(response.body);
		switch (body.type) {
			case "room-joined":
				this.state = "active";
				$room.set(body.payload);
				return body.payload;
			case "error":
				this.state = "failed";
				throw new Error(
					body.payload.code === "NOT_FOUND"
						? "Room not found"
						: body.payload.message,
				);
			default:
				this.state = "failed";
				throw new Error("Failed to join room");
		}
	}

	async leave() {
		const room = $room.get();
		if (!room) return;
		await this.#server
			.sendRequest({
				type: "leave-room",
				payload: { room_id: room.id },
			})
			.catch(console.error);
		this.state = "idle";
		$room.set(undefined);
		removeConnections();
	}

	async create(): Promise<string> {
		this.state = "idle";
		const room = $room.get();
		if (room) {
			await this.leave();
		}
		const response = await this.#server.sendRequest({
			type: "create-room",
		});
		const body = parseBody(response.body);
		switch (body.type) {
			case "room-created":
				return body.payload.id;
			case "error":
				this.state = "failed";
				throw new Error(body.payload.message);
			default:
				this.state = "failed";
				throw new Error("Failed to create room");
		}
	}
}
