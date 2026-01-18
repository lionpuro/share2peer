import { atom } from "nanostores";
import type { CustomEventTarget } from "#/lib/events";
import {
	OfferSchema,
	AnswerSchema,
	ErrorSchema,
	ICECandidateSchema,
	IdentitySchema,
	SocketMessageEvent,
	type Client,
	parseMessage,
	type OutgoingMessage,
	type MessageEventMap,
} from "#/lib/schemas";
import {
	closePeerConnections,
	handleAnswer,
	handleICECandidate,
	handleOffer,
} from "#/lib/webrtc";

declare global {
	interface Window {
		__WebSocketManager: WebSocketManager | undefined;
	}
}

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
		window.__WebSocketManager?.close();
		window.__WebSocketManager = this;
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
				const data = JSON.parse(e.data) as unknown;
				const message = parseMessage(data);
				switch (message.type) {
					case "error":
						console.error(ErrorSchema.parse(message).payload.code);
						break;
					case "identity":
						$identity.set(IdentitySchema.parse(message).payload);
						break;
					case "offer":
						await handleOffer(this, OfferSchema.parse(message));
						break;
					case "answer":
						await handleAnswer(AnswerSchema.parse(message));
						break;
					case "ice-candidate":
						await handleICECandidate(ICECandidateSchema.parse(message));
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
			const event = parseMessage(msg);
			this.dispatchEvent(new SocketMessageEvent(event.type, event));
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

	async send(msg: OutgoingMessage) {
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
	const { VITE_WS_PROTOCOL, VITE_WS_HOST, VITE_WS_ENDPOINT } = import.meta.env;
	if (!import.meta.env.DEV || !VITE_WS_HOST.startsWith("localhost")) {
		return new URL(
			VITE_WS_ENDPOINT,
			`${VITE_WS_PROTOCOL}://${VITE_WS_HOST}`,
		).toString();
	}

	const url = new URL(
		VITE_WS_ENDPOINT,
		`${VITE_WS_PROTOCOL}://${new URL(import.meta.url).host}`,
	);
	return url.toString();
}

export const socket = new WebSocketManager(resolveSocketURL());
