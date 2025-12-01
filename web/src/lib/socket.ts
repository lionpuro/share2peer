import { atom } from "nanostores";
import { MessageType, type Message } from "./message";

type Client = {
	id: string;
};

type Session = {
	id: string;
	clients: Client[];
};

export const $session = atom<Session | null>(null);
export const $identity = atom<Client | null>(null);
export const $isConnected = atom<boolean>(false);

class WebSocketManager {
	#url: string;
	#ws: WebSocket | null = null;
	constructor(url: string) {
		this.#url = url;
		this.connect();
	}

	connect() {
		this.#ws = new WebSocket(this.#url);
		this.#ws.addEventListener("error", (e) => {
			console.error("WebSocket error: " + JSON.stringify(e));
		});
		this.#ws.addEventListener("open", () => {
			$isConnected.set(true);
		});
		this.#ws.addEventListener("close", () => {
			$isConnected.set(false);
			setTimeout(() => {
				this.connect();
			}, 1000);
		});

		this.#ws.addEventListener("message", async (e) => {
			try {
				const message = JSON.parse(e.data);
				switch (message.type) {
					case MessageType.Error:
						console.error(message.payload);
						break;
					case MessageType.Identity:
						if (!message.payload.id) {
							console.error("invalid identity payload");
							break;
						}
						$identity.set({ id: message.payload.id });
						break;
					// Sessions
					case MessageType.SessionInfo:
						$session.set(message.payload);
						break;
					case MessageType.SessionCreated:
						$session.set(message.payload);
						break;
					case MessageType.SessionJoined:
						if (typeof message.payload?.id !== "string") {
							return console.error("failed to join session");
						}
						$session.set(message.payload);
						break;
				}
			} catch (err) {
				console.error(err);
			}
		});
	}

	close() {
		if (this.#ws) {
			this.#ws.close();
			this.#ws = null;
		}
		$session.set(null);
		$isConnected.set(false);
	}

	send<T extends Message>(msg: T) {
		if (!this.#ws) {
			console.error(
				"failed to send message: not currently connected to a websocket",
			);
			return;
		}
		this.#ws.send(JSON.stringify(msg));
	}
}

const url = `${import.meta.env.VITE_WS_PROTOCOL}://${import.meta.env.VITE_WS_HOST}/ws`;
export const websocket = new WebSocketManager(url);
