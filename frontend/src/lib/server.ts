import { TypedEventTarget } from "typescript-event-target";
import {
	parseMessage,
	RequestResponseMap,
	type IncomingMessage,
	type OutgoingMessage,
} from "#/lib/schemas/signaling";
import { $connectionState, $identity, $networkUsers } from "#/stores/signaling";
import {
	handleAnswer,
	handleICECandidate,
	handleOffer,
	removeConnections,
} from "#/lib/webrtc";
import {
	closeRoom,
	handleRoomInfo,
	handleRoomLeft,
	handleUserJoined,
	handleUserLeft,
} from "./room";

declare global {
	interface Window {
		__WEBSEND_SERVER: SignalingServer | undefined;
	}
}

const PING_INTERVAL = 55000;

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;

type Transaction<Type extends keyof typeof RequestResponseMap> = {
	action: Type;
	resolve: (value: ResponseMap[Type]) => void;
	reject: (reason?: unknown) => void;
};

type ResponseMap = {
	"create-room": Extract<IncomingMessage, { type: "room-created" }>;
	"join-room": Extract<IncomingMessage, { type: "room-joined" }>;
	"leave-room": Extract<IncomingMessage, { type: "room-left" }>;
};

export type ServerEventMap = {
	[M in IncomingMessage as M["type"]]: CustomEvent<M["payload"]>;
} & {
	close: CustomEvent;
};

type ServerEvent = ServerEventMap[keyof ServerEventMap];

export class SignalingServer extends TypedEventTarget<ServerEventMap> {
	#url: string;
	#ws: WebSocket | undefined = undefined;
	#currentID: number = 0;
	#transactions: Map<string, Transaction<keyof typeof RequestResponseMap>> =
		new Map();
	#reconnectAttempts: number = 0;
	#reconnectTimeout: number | undefined = undefined;
	#pingTimer: number | undefined = undefined;
	#destroyed: boolean = false;

	constructor(url: string) {
		super();
		this.#url = url;
		$connectionState.set("connecting");
		this.#ws = this.#createSocket();
	}

	#createSocket(): WebSocket {
		this.#ws = new WebSocket(this.#url);
		this.#ws.addEventListener("open", this.#onopen);
		this.#ws.addEventListener("close", this.#onclose);
		this.#ws.addEventListener("message", this.#onmessage);
		this.#ws.addEventListener("error", this.#onerror);
		// ping
		this.#ws.addEventListener("open", () => this.startKeepAlive());
		this.#ws.addEventListener("close", () => this.stopKeepAlive());
		return this.#ws;
	}

	async connect(): Promise<WebSocket> {
		if (this.#ws?.readyState === WebSocket.OPEN) {
			return this.#ws;
		}
		if (this.#ws?.readyState === WebSocket.CONNECTING) {
			return new Promise((resolve, reject) => {
				if (!this.#ws) {
					return reject(new Error("connection unavailable"));
				}
				this.#ws.addEventListener("open", () => {
					if (!this.#ws) {
						return reject(new Error("connection unavailable"));
					}
					resolve(this.#ws);
				});
			});
		}

		try {
			$connectionState.set("connecting");
			this.#ws = this.#createSocket();

			this.#reconnectAttempts = 0;
			this.#destroyed = false;
			clearTimeout(this.#reconnectTimeout);
			this.#reconnectTimeout = undefined;

			await waitForOpen(this.#ws);
			return this.#ws;
		} catch (err) {
			$connectionState.set("failed");
			throw err;
		}
	}

	#reconnect() {
		if (this.#reconnectTimeout || this.#destroyed) {
			return;
		}

		this.#reconnectAttempts += 1;
		const delay = Math.min(
			MIN_RECONNECT_DELAY * 2 ** (this.#reconnectAttempts - 1),
			MAX_RECONNECT_DELAY,
		);
		this.#reconnectTimeout = setTimeout(() => {
			this.#reconnectTimeout = undefined;
			this.connect().catch(() => {
				if (!this.#destroyed) {
					this.#reconnect();
				}
			});
		}, delay);
	}

	destroy() {
		this.#destroyed = true;
		clearTimeout(this.#reconnectTimeout);
		this.#reconnectTimeout = undefined;
		if (this.#ws) {
			this.#ws.removeEventListener("open", this.#onopen);
			this.#ws.removeEventListener("close", this.#onclose);
			this.#ws.removeEventListener("message", this.#onmessage);
			this.#ws.removeEventListener("error", this.#onerror);
			this.#ws.close();
		}
	}

	async request<
		Req extends Extract<
			OutgoingMessage,
			{ type: keyof typeof RequestResponseMap }
		>,
	>(msg: Req): Promise<ResponseMap[Req["type"]]> {
		const ws = await this.connect();

		this.#currentID++;
		const id = this.#currentID.toString();
		msg.transaction = id;

		const tx: Transaction<Req["type"]> = {
			action: msg.type,
			resolve: () => {},
			reject: () => {},
		};

		const timeout = setTimeout(() => {
			const tx = this.#transactions.get(id);
			if (!tx) return;
			tx.reject(new Error("action timed out"));
			this.#transactions.delete(id);
		}, 8000);

		const promise = new Promise<ResponseMap[Req["type"]]>((resolve, reject) => {
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

	async send(msg: OutgoingMessage) {
		const ws = await this.connect();
		ws.send(JSON.stringify(msg));
	}

	#onerror = (e: Event) => {
		$connectionState.set("failed");
		console.error("WebSocket error: " + JSON.stringify(e));
	};

	#onopen = () => {
		$connectionState.set("connected");
	};

	#onclose = () => {
		$connectionState.set("disconnected");
		$identity.set(undefined);
		removeConnections();
		closeRoom();
		this.dispatchTypedEvent("close", new CustomEvent("close"));
		if (!this.#destroyed) {
			this.#reconnect();
		}
	};

	#onmessage = async (e: MessageEvent) => {
		try {
			const message = parseMessage(e.data as unknown);

			if (message.transaction) {
				const tx = this.#transactions.get(message.transaction);
				if (!tx) return;
				switch (message.type) {
					case RequestResponseMap[tx.action]:
						tx.resolve(message);
						break;
					case "error":
						tx.reject(new Error(message.payload.message));
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

			switch (message.type) {
				case "error":
					console.error(message.payload.code);
					break;
				case "identity":
					$identity.set(message.payload);
					break;
				case "network-users":
					$networkUsers.set(message.payload.users);
					break;
				case "offer":
					await handleOffer(this, message);
					break;
				case "answer":
					await handleAnswer(message);
					break;
				case "ice-candidate":
					await handleICECandidate(message);
					break;
				case "room-info":
					handleRoomInfo(message.payload);
					break;
				case "room-left":
					handleRoomLeft();
					break;
				case "user-joined":
					await handleUserJoined(this, message.payload);
					break;
				case "user-left":
					handleUserLeft(message.payload);
					break;
			}
			this.#dispatchMessageEvent(message);
		} catch (err) {
			console.error("handle message:", err);
		}
	};

	startKeepAlive() {
		if (this.#destroyed) return;
		const schedulePing = async () => {
			this.#pingTimer = setTimeout(() => {
				if (this.#destroyed) return;
				if (this.#ws?.readyState !== WebSocket.OPEN) return;
				this.send({ type: "ping" })
					.then(() => schedulePing())
					.catch((err) => console.error("ping:", err));
			}, PING_INTERVAL);
		};
		schedulePing();
	}

	stopKeepAlive() {
		if (this.#pingTimer) {
			clearTimeout(this.#pingTimer);
			this.#pingTimer = undefined;
		}
	}

	#dispatchMessageEvent(message: IncomingMessage) {
		const event: ServerEvent = new CustomEvent(message.type, {
			detail: message.payload,
		});
		this.dispatchTypedEvent(message.type, event);
	}
}

function waitForOpen(sock: WebSocket) {
	return new Promise<WebSocket>((resolve, reject) => {
		if (sock.readyState === WebSocket.CONNECTING) {
			sock.addEventListener("open", () => resolve(sock));
			return;
		}
		if (sock.readyState === WebSocket.OPEN) {
			resolve(sock);
			return;
		}
		reject(
			new Error(
				`websocket is ${sock.readyState === WebSocket.CLOSING ? "closing" : "closed"}`,
			),
		);
	});
}

function resolveSocketURL(): string {
	const { VITE_WS_PROTOCOL, VITE_WS_HOST, VITE_WS_ENDPOINT } = import.meta.env;
	const host = VITE_WS_HOST.startsWith("localhost:")
		? new URL(import.meta.url).host
		: VITE_WS_HOST;

	return new URL(VITE_WS_ENDPOINT, `${VITE_WS_PROTOCOL}://${host}`).toString();
}

let instance: SignalingServer | undefined;

function getServer(): SignalingServer {
	if (!instance) {
		window.__WEBSEND_SERVER?.destroy();
		instance = new SignalingServer(resolveSocketURL());
		window.__WEBSEND_SERVER = instance;
	}
	return instance;
}

export const server = getServer();
