import { atom } from "nanostores";
import type { Session } from "./schemas";
import type { SignalingServer, ServerEventMap } from "./server";
import {
	connections,
	createPeerConnection,
	type MessageChannelMessage,
} from "./webrtc";

export const $session = atom<Session | null>(null);

type SessionState = "idle" | "joining" | "active" | "failed";

export class SessionManager {
	#server: SignalingServer;
	state: SessionState = "idle";

	constructor(server: SignalingServer) {
		this.#server = server;
		this.#server.addEventListener("close", () => {
			$session.set(null);
			this.state = "idle";
		});
		this.#server.addEventListener("session-info", (e) => {
			$session.set(e.detail);
		});
		this.#server.addEventListener("session-left", () => {
			$session.set(null);
			this.state = "idle";
			connections.clear();
		});
		this.#server.addEventListener("client-joined", async (e) => {
			const id = e.detail.id;
			if (connections.get(id)) return;
			const session = $session.get();
			if (!session) return;
			await createPeerConnection(this.#server, session.id, e.detail);
		});
		this.#server.addEventListener("client-left", (e) => {
			connections.remove(e.detail.id);
		});
	}

	broadcast(msg: MessageChannelMessage) {
		$session.get()?.clients?.forEach((c) => connections.get(c.id)?.send(msg));
	}

	join(id: string): Promise<Session> {
		return new Promise((resolve, reject) => {
			if (this.state === "joining") {
				reject(new Error("already joining a session"));
				return;
			}

			const timeout = setTimeout(() => {
				this.#server.removeEventListener("error", onError);
				this.#server.removeEventListener("session-not-found", onNotFound);
				this.#server.removeEventListener("session-joined", onJoin);
				this.state = "failed";
				reject(new Error("request timed out"));
			}, 10 * 1000);

			const onNotFound = (e: ServerEventMap["session-not-found"]) => {
				if (e.detail.session_id === id) {
					this.#server.removeEventListener("error", onError);
					this.#server.removeEventListener("session-not-found", onNotFound);
					this.#server.removeEventListener("session-joined", onJoin);
					clearTimeout(timeout);
					this.state = "failed";
					reject(new Error("Session not found"));
				}
			};
			this.#server.addEventListener("session-not-found", onNotFound);

			const onError = (e: ServerEventMap["error"]) => {
				this.#server.removeEventListener("error", onError);
				this.#server.removeEventListener("session-not-found", onNotFound);
				this.#server.removeEventListener("session-joined", onJoin);
				clearTimeout(timeout);
				this.state = "failed";
				const err = e.detail;
				reject(new Error(err.message));
			};
			this.#server.addEventListener("error", onError);

			const onJoin = (e: ServerEventMap["session-joined"]) => {
				const session = e.detail;
				if (session.id !== id) return;
				this.#server.removeEventListener("error", onError);
				this.#server.removeEventListener("session-not-found", onNotFound);
				this.#server.removeEventListener("session-joined", onJoin);
				clearTimeout(timeout);
				this.state = "active";
				$session.set(session);
				resolve(session);
			};
			this.#server.addEventListener("session-joined", onJoin);

			this.state = "joining";
			this.#server.send({
				type: "join-session",
				payload: { session_id: id },
			});
		});
	}

	leave() {
		this.state = "idle";
		const session = $session.get();
		if (!session) return;
		this.#server.send({
			type: "leave-session",
			payload: { session_id: session.id },
		});
	}

	create(): Promise<string> {
		this.state = "idle";
		const session = $session.get();
		if (session) {
			this.leave();
		}
		return new Promise((resolve, reject) => {
			const onTimeout = () => {
				this.#server.removeEventListener("error", onError);
				this.#server.removeEventListener("session-created", onCreate);
				this.state = "idle";
				reject(new Error("request timed out"));
			};
			const timeout = setTimeout(onTimeout, 10 * 1000);

			const onError = (e: ServerEventMap["error"]) => {
				this.#server.removeEventListener("error", onError);
				this.#server.removeEventListener("session-created", onCreate);
				clearTimeout(timeout);
				this.state = "failed";
				const err = e.detail;
				reject(new Error(err.message));
			};
			this.#server.addEventListener("error", onError);

			const onCreate = (e: ServerEventMap["session-created"]) => {
				this.#server.removeEventListener("session-created", onCreate);
				clearTimeout(timeout);
				const session = e.detail;
				resolve(session.id);
			};

			this.#server.addEventListener("session-created", onCreate);

			this.#server.send({ type: "request-session" });
		});
	}
}
