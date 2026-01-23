import { atom } from "nanostores";
import type { CustomEventTarget } from "#/lib/events";
import {
	OfferSchema,
	AnswerSchema,
	ErrorSchema,
	ICECandidateSchema,
	IdentitySchema,
	ServerMessageEvent,
	type Client,
	parseMessage,
	type OutgoingMessage,
	type MessageEventMap,
} from "#/lib/schemas";
import {
	connections,
	handleAnswer,
	handleICECandidate,
	handleOffer,
} from "#/lib/webrtc";

declare global {
	interface Window {
		__SignalingServer: SignalingServer | undefined;
	}
}

export const $identity = atom<Client | null>(null);

type ConnectionState = "closed" | "connecting" | "open" | "error";

export const $connectionState = atom<ConnectionState>("closed");

export type ServerEventTarget = CustomEventTarget<
	MessageEventMap & {
		close: CustomEvent;
	}
>;

export class SignalingServer extends (EventTarget as ServerEventTarget) {
	#url: string;
	#ws: WebSocket | null = null;
	constructor(url: string) {
		super();
		this.#url = url;
		window.__SignalingServer?.close();
		window.__SignalingServer = this;
		this.connect().catch((err) => console.error(err));
	}

	async connect(): Promise<WebSocket> {
		if (this.#ws && this.#ws.readyState === 1) {
			return this.#ws;
		}

		if ($connectionState.get() !== "open") {
			$connectionState.set("connecting");
		}
		try {
			this.#ws = await openSocket(this.#url);
			$connectionState.set("open");

			this.#ws.addEventListener("error", (e) => {
				$connectionState.set("error");
				console.error("WebSocket error: " + JSON.stringify(e));
			});
			this.#ws.addEventListener("close", async () => {
				$connectionState.set("closed");
				connections.clear();
				this.dispatchEvent(new CustomEvent("close"));
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

			return this.#ws;
		} catch (err) {
			$connectionState.set("error");
			throw err;
		}
	}

	private onMessage(e: MessageEvent) {
		try {
			const msg = JSON.parse(e.data) as unknown;
			const event = parseMessage(msg);
			this.dispatchEvent(new ServerMessageEvent(event.type, event));
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
	}

	async send(msg: OutgoingMessage) {
		const ws = await this.connect();
		ws.send(JSON.stringify(msg));
	}
}

function openSocket(url: string): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url);

		const onError = () => {
			clearTimeout(timeout);
			reject("failed to connect");
		};
		const onOpen = () => {
			ws.removeEventListener("error", onError);
			ws.removeEventListener("open", onOpen);
			clearTimeout(timeout);
			resolve(ws);
		};

		const timeout = setTimeout(() => {
			ws.removeEventListener("error", onError);
			ws.removeEventListener("open", onOpen);
			reject("connection timed out");
		}, 5000);

		ws.addEventListener("error", onError);
		ws.addEventListener("open", onOpen);
	});
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

export const server = new SignalingServer(resolveSocketURL());
