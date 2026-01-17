import { atom } from "nanostores";
import type { MessageEventMap, Session } from "./schemas";
import type { WebSocketManager } from "./socket";
import {
	closePeerConnection,
	closePeerConnections,
	createOffer,
	findPeer,
} from "./webrtc";

export const $session = atom<Session | null>(null);

type SessionState = "idle" | "joining" | "active" | "failed";

export class SessionManager {
	#ws: WebSocketManager;
	state: SessionState = "idle";

	constructor(ws: WebSocketManager) {
		this.#ws = ws;
		this.#ws.addEventListener("close", () => {
			$session.set(null);
			this.state = "idle";
		});
		this.#ws.addEventListener("session-info", (e) => {
			$session.set(e.detail.payload);
		});
		this.#ws.addEventListener("session-left", () => {
			$session.set(null);
			this.state = "idle";
			closePeerConnections();
		});
		this.#ws.addEventListener("client-joined", async (e) => {
			const id = e.detail.payload.id;
			if (findPeer(id)) return;
			await createOffer(this.#ws, id);
		});
		this.#ws.addEventListener("client-left", (e) => {
			closePeerConnection(e.detail.payload.id);
		});
	}

	join(id: string): Promise<Session> {
		return new Promise((resolve, reject) => {
			if (this.state === "joining") {
				reject(new Error("already joining a session"));
				return;
			}

			const timeout = setTimeout(() => {
				this.#ws.removeEventListener("error", onError);
				this.#ws.removeEventListener("session-not-found", onNotFound);
				this.#ws.removeEventListener("session-joined", onJoin);
				this.state = "failed";
				reject(new Error("request timed out"));
			}, 10 * 1000);

			const onNotFound = (e: MessageEventMap["session-not-found"]) => {
				if (e.detail.payload.session_id === id) {
					this.#ws.removeEventListener("error", onError);
					this.#ws.removeEventListener("session-not-found", onNotFound);
					this.#ws.removeEventListener("session-joined", onJoin);
					clearTimeout(timeout);
					this.state = "failed";
					reject(new Error("Session not found"));
				}
			};
			this.#ws.addEventListener("session-not-found", onNotFound);

			const onError = (e: MessageEventMap["error"]) => {
				this.#ws.removeEventListener("error", onError);
				this.#ws.removeEventListener("session-not-found", onNotFound);
				this.#ws.removeEventListener("session-joined", onJoin);
				clearTimeout(timeout);
				this.state = "failed";
				const err = e.detail.payload;
				reject(new Error(err.message));
			};
			this.#ws.addEventListener("error", onError);

			const onJoin = (e: MessageEventMap["session-joined"]) => {
				const session = e.detail.payload;
				if (session.id !== id) return;
				this.#ws.removeEventListener("error", onError);
				this.#ws.removeEventListener("session-not-found", onNotFound);
				this.#ws.removeEventListener("session-joined", onJoin);
				clearTimeout(timeout);
				this.state = "active";
				$session.set(session);
				resolve(session);
			};
			this.#ws.addEventListener("session-joined", onJoin);

			this.state = "joining";
			this.#ws.send({
				type: "join-session",
				payload: { session_id: id },
			});
		});
	}

	leave() {
		this.state = "idle";
		const session = $session.get();
		if (!session) return;
		this.#ws.send({
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
				this.#ws.removeEventListener("error", onError);
				this.#ws.removeEventListener("session-created", onCreate);
				this.state = "idle";
				reject(new Error("request timed out"));
			};
			const timeout = setTimeout(onTimeout, 10 * 1000);

			const onError = (e: MessageEventMap["error"]) => {
				this.#ws.removeEventListener("error", onError);
				this.#ws.removeEventListener("session-created", onCreate);
				clearTimeout(timeout);
				this.state = "failed";
				const err = e.detail.payload;
				reject(new Error(err.message));
			};
			this.#ws.addEventListener("error", onError);

			const onCreate = (e: MessageEventMap["session-created"]) => {
				this.#ws.removeEventListener("session-created", onCreate);
				clearTimeout(timeout);
				const session = e.detail.payload;
				resolve(session.id);
			};

			this.#ws.addEventListener("session-created", onCreate);

			this.#ws.send({ type: "request-session" });
		});
	}
}
