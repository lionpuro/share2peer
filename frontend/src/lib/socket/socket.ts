import { atom } from "nanostores";
import type { CustomEventTarget } from "#/lib/events";
import {
	OfferSchema,
	AnswerSchema,
	ErrorSchema,
	ICECandidateSchema,
	IdentitySchema,
	isMessageType,
	MessageType,
	SocketMessageEvent,
	type Message,
	type Client,
	type MessageEventMap,
} from "#/lib/schemas";
import {
	closePeerConnections,
	handleAnswer,
	handleICECandidate,
	handleOffer,
} from "#/lib/webrtc";

export const $identity = atom<Client | null>(null);

type ConnectionState = "closed" | "connecting" | "open" | "error";

export const $connectionState = atom<ConnectionState>("closed");

export type SocketEventTarget = CustomEventTarget<
	MessageEventMap & {
		close: CustomEvent;
	}
>;

export class WebSocketManager extends (EventTarget as SocketEventTarget) {
	#url: string;
	#ws: WebSocket | null = null;
	constructor(url: string) {
		super();
		this.#url = url;
		this.connect();
	}

	connect() {
		// close previous connection
		if (this.#ws) {
			this.close();
		}

		$connectionState.set("connecting");
		this.#ws = new WebSocket(this.#url);

		this.#ws.addEventListener("error", (e) => {
			$connectionState.set("error");
			console.error("WebSocket error: " + JSON.stringify(e));
		});
		this.#ws.addEventListener("open", () => {
			$connectionState.set("open");
		});
		this.#ws.addEventListener("close", () => {
			$connectionState.set("closed");
			closePeerConnections();
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
						console.error(ErrorSchema.parse(message).payload.code);
						break;
					case MessageType.Identity:
						$identity.set(IdentitySchema.parse(message).payload);
						break;
					case MessageType.Offer:
						await handleOffer(this, OfferSchema.parse(message));
						break;
					case MessageType.Answer:
						await handleAnswer(AnswerSchema.parse(message));
						break;
					case MessageType.ICECandidate:
						await handleICECandidate(ICECandidateSchema.parse(message));
						break;
					case MessageType.SessionInfo:
					case MessageType.SessionCreated:
					case MessageType.SessionJoined:
					case MessageType.SessionLeft:
					case MessageType.ClientJoined:
					case MessageType.ClientLeft:
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
		$connectionState.set("closed");
		this.dispatchEvent(new CustomEvent("close"));
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

function resolveSocketURL() {
	const { VITE_WS_HOST, VITE_WS_ENDPOINT } = import.meta.env;
	if (!import.meta.env.DEV || !VITE_WS_HOST.startsWith("localhost")) {
		return new URL(VITE_WS_ENDPOINT, `ws://${VITE_WS_HOST}`).toString();
	}

	const url = new URL(
		VITE_WS_ENDPOINT,
		`ws://${new URL(import.meta.url).host}`,
	);
	return url.toString();
}
export const socket = new WebSocketManager(resolveSocketURL());
