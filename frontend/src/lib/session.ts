import { $session } from "#/stores/signaling";
import { parseBody, type Session } from "./schemas";
import type { SignalingServer } from "./server";
import {
	createPeerConnection,
	findConnection,
	removeConnection,
	removeConnections,
} from "./webrtc";

type SessionState = "idle" | "joining" | "active" | "failed";

export class SessionManager {
	#server: SignalingServer;
	state: SessionState = "idle";

	constructor(server: SignalingServer) {
		this.#server = server;
		this.#server.addEventListener("close", () => {
			$session.set(undefined);
			this.state = "idle";
		});
		this.#server.addEventListener("session-info", (e) => {
			$session.set(e.detail);
		});
		this.#server.addEventListener("session-left", () => {
			$session.set(undefined);
			this.state = "idle";
			removeConnections();
		});
		this.#server.addEventListener("client-joined", async (e) => {
			const id = e.detail.id;
			if (findConnection(id)) return;
			const session = $session.get();
			if (!session) return;
			await createPeerConnection(this.#server, session.id, e.detail);
		});
		this.#server.addEventListener("client-left", (e) => {
			removeConnection(e.detail.id);
		});
	}

	async join(id: string): Promise<Session> {
		if (this.state === "joining" || this.state === "active") {
			throw new Error("already joining a session");
		}
		this.state = "joining";
		const response = await this.#server.sendRequest({
			type: "join-session",
			payload: { session_id: id },
		});
		const body = parseBody(response.body);
		switch (body.type) {
			case "session-joined":
				this.state = "active";
				$session.set(body.payload);
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
		const session = $session.get();
		if (!session) return;
		await this.#server
			.sendRequest({
				type: "leave-session",
				payload: { session_id: session.id },
			})
			.catch(console.error);
		this.state = "idle";
		$session.set(undefined);
		removeConnections();
	}

	async create(): Promise<string> {
		this.state = "idle";
		const session = $session.get();
		if (session) {
			await this.leave();
		}
		const response = await this.#server.sendRequest({
			type: "request-session",
		});
		const body = parseBody(response.body);
		switch (body.type) {
			case "session-created":
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
