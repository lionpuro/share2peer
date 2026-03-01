import { TypedEventTarget } from "typescript-event-target";
import {
	parseBody,
	parseMessage,
	RequestResponseMap,
	type IncomingMessageBody,
	type Message,
	type OutgoingMessage,
	type OutgoingMessageBody,
} from "#/lib/schemas/signaling";
import { $connectionState, $identity } from "#/stores/signaling";
import {
	handleAnswer,
	handleICECandidate,
	handleOffer,
	removeConnections,
} from "#/lib/webrtc";

declare global {
	interface Window {
		__SignalingServer: SignalingServer | undefined;
	}
}

type Transaction<Type extends keyof typeof RequestResponseMap> = {
	action: Type;
	resolve: (value: Message) => void;
	reject: (reason?: unknown) => void;
};

type PendingTransaction =
	| Transaction<"join-room">
	| Transaction<"leave-room">
	| Transaction<"request-room">;

export type ServerEventMap = {
	[M in IncomingMessageBody as M["type"]]: CustomEvent<M["payload"]>;
} & {
	close: CustomEvent;
};

type ServerEvent = ServerEventMap[keyof ServerEventMap];

export class SignalingServer extends TypedEventTarget<ServerEventMap> {
	#url: string;
	#ws: WebSocket | undefined = undefined;
	#currentID: number = 0;
	#transactions: Map<string, PendingTransaction> = new Map();

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
				removeConnections();
				this.dispatchTypedEvent("close", new CustomEvent("close"));
				setTimeout(() => {
					this.connect();
				}, 1000);
			});
			this.#ws.addEventListener("message", async (e) => {
				try {
					const message = parseMessage(e.data);
					if (message.transaction) {
						const tx = this.#transactions.get(message.transaction);
						if (!tx) return;
						const body = parseBody(message.body);
						switch (body.type) {
							case RequestResponseMap[tx.action]:
							case "error":
								tx.resolve(message);
								break;
							default:
								tx.reject(
									new Error(
										`received unexpected response "${message.type}" to request "${tx.action}"`,
									),
								);
								break;
						}
						return;
					}

					const body = parseBody(message.body);
					switch (body.type) {
						case "error":
							console.error(body.payload.code);
							break;
						case "identity":
							$identity.set(body.payload);
							break;
						case "offer":
							await handleOffer(this, body);
							break;
						case "answer":
							await handleAnswer(body);
							break;
						case "ice-candidate":
							await handleICECandidate(body);
							break;
					}
				} catch (err) {
					console.error(err);
				}
			});
			this.#ws.addEventListener("message", (e) => {
				try {
					const message = parseMessage(e.data);
					if (message.transaction || message.type !== "message") return;
					const body = parseBody(message.body);
					this.#dispatchMessageEvent(body);
				} catch (err) {
					console.error(err);
				}
			});

			return this.#ws;
		} catch (err) {
			$connectionState.set("error");
			throw err;
		}
	}

	close() {
		if (this.#ws) {
			this.#ws.close();
			this.#ws = undefined;
		}
		$connectionState.set("closed");
	}

	async sendRequest<
		Body extends Extract<
			OutgoingMessageBody,
			{ type: keyof typeof RequestResponseMap }
		>,
	>(body: Body): Promise<Message> {
		const ws = await this.connect();

		this.#currentID++;
		const id = this.#currentID.toString();
		const msg: OutgoingMessage = {
			transaction: id,
			type: "request",
			body,
		};

		const tx: PendingTransaction = {
			action: body.type,
			resolve: () => {},
			reject: () => {},
		};

		const timeout = setTimeout(() => {
			const tx = this.#transactions.get(id);
			if (!tx) return;
			tx.reject(new Error("action timed out"));
			this.#transactions.delete(id);
		}, 8000);

		const promise = new Promise<Message>((resolve, reject) => {
			tx.resolve = (v) => {
				clearTimeout(timeout);
				resolve(v);
			};
			tx.reject = (v) => {
				clearTimeout(timeout);
				reject(v);
			};
		});

		this.#transactions.set(id, tx);
		ws.send(JSON.stringify(msg));

		return promise;
	}

	async send(body: OutgoingMessageBody) {
		const msg: OutgoingMessage = {
			type: "message",
			body,
		};
		const ws = await this.connect();
		ws.send(JSON.stringify(msg));
	}

	#dispatchMessageEvent(body: IncomingMessageBody) {
		const event: ServerEvent = new CustomEvent(body.type, {
			detail: body.payload,
		});
		this.dispatchTypedEvent(body.type, event);
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
