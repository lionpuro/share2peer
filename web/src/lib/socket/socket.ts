import { atom } from "nanostores";
import {
	ErrorSchema,
	IdentitySchema,
	isMessageType,
	MessageType,
	SessionCreatedSchema,
	SessionInfoSchema,
	SessionJoinedSchema,
	SocketMessageEvent,
	type Message,
	type SocketMessageEventTarget,
} from "../message";
import { $session, type Client } from "../session";

export const $identity = atom<Client | null>(null);
export const $isConnected = atom<boolean>(false);

class WebSocketManager extends (EventTarget as SocketMessageEventTarget) {
	#url: string;
	#ws: WebSocket | null = null;
	constructor(url: string) {
		super();
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
				if (
					!message ||
					typeof message !== "object" ||
					!isMessageType(message.type)
				) {
					console.error("unrecognized message format");
					return;
				}
				switch (message.type) {
					case MessageType.Error:
						console.error(ErrorSchema.parse(message).payload);
						break;
					case MessageType.Identity:
						$identity.set({ id: IdentitySchema.parse(message).payload.id });
						break;
					case MessageType.SessionInfo:
						$session.set(SessionInfoSchema.parse(message).payload || null);
						break;
					case MessageType.SessionCreated:
						$session.set({
							id: SessionCreatedSchema.parse(message).payload.session_id,
						});
						break;
					case MessageType.SessionJoined:
						$session.set(SessionJoinedSchema.parse(message).payload);
						break;
					case MessageType.SessionLeft:
						$session.set(null);
						break;
					default:
						console.error(`WebSocket: unknown message type '${message.type}'`);
						break;
				}
			} catch (err) {
				console.error(err);
			}
		});
		this.#ws.addEventListener("message", this.onMessage.bind(this));
	}

	private onMessage(e: MessageEvent) {
		try {
			const msg = JSON.parse(e.data) as unknown;
			if (
				!msg ||
				typeof msg !== "object" ||
				!("type" in msg) ||
				!("payload" in msg)
			) {
				console.error("unrecognized message format");
				return;
			}
			if (!isMessageType(msg.type)) {
				console.error("unknown message type");
				return;
			}
			const { type, payload } = msg;
			this.dispatchEvent(new SocketMessageEvent(type, { type, payload }));
		} catch (err) {
			console.error(err);
		}
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

export const socket = new WebSocketManager(import.meta.env.VITE_WS_URL);
