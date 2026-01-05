import { atom } from "nanostores";
import {
	ClientJoinedSchema,
	OfferSchema,
	AnswerSchema,
	ErrorSchema,
	ICECandidateSchema,
	IdentitySchema,
	isMessageType,
	MessageType,
	SessionCreatedSchema,
	SessionInfoSchema,
	SessionJoinedSchema,
	SocketMessageEvent,
	type Message,
	type SocketMessageEventTarget,
	ClientLeftSchema,
	type ClientJoinedMessage,
} from "#/lib/message";
import { $session } from "#/lib/session";
import type { Client } from "#/lib/client";
import {
	closePeerConnection,
	closePeerConnections,
	createOffer,
	findPeer,
	handleAnswer,
	handleICECandidate,
	handleOffer,
} from "#/lib/webrtc";

export const $identity = atom<Client | null>(null);

type ConnectionState = "closed" | "connecting" | "open" | "error";

export const $connectionState = atom<ConnectionState>("closed");

export class WebSocketManager extends (EventTarget as SocketMessageEventTarget) {
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
					case MessageType.SessionInfo:
						$session.set(SessionInfoSchema.parse(message).payload || null);
						break;
					case MessageType.SessionCreated:
						$session.set(SessionCreatedSchema.parse(message).payload);
						break;
					case MessageType.SessionJoined:
						$session.set(SessionJoinedSchema.parse(message).payload);
						break;
					case MessageType.SessionLeft:
						$session.set(null);
						closePeerConnections();
						break;
					case MessageType.ClientJoined:
						await handleClientJoined(this, ClientJoinedSchema.parse(message));
						break;
					case MessageType.ClientLeft:
						closePeerConnection(ClientLeftSchema.parse(message).payload.id);
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
		$connectionState.set("closed");
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

async function handleClientJoined(
	sock: WebSocketManager,
	msg: ClientJoinedMessage,
) {
	const host = $identity.get()?.id === $session.get()?.host;
	if (!host) return;

	if (findPeer(msg.payload.id)) {
		return;
	}
	await createOffer(sock, msg.payload.id);
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
