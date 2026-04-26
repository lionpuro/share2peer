import { TypedEventTarget } from "typescript-event-target";
import {
	parseMessage,
	RequestResponseMap,
	type IncomingMessage,
	type OutgoingMessage,
} from "#/lib/schemas/signaling";
import {
	$connectionState,
	$identity,
	$networkUsers,
	getSessionData,
	setSessionData,
} from "#/stores/signaling";
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
} from "#/lib/signaling/room";
import { stringToBase64 } from "#/lib/helper";

declare global {
	interface Window {
		__WEBSEND_SERVER: SignalingServer | undefined;
	}
}

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

type ConnectionState = ReturnType<typeof $connectionState.get>;

type Config = {
	url: string;
	pingInterval: number;
	minReconnectDelay: number;
	maxReconnectDelay: number;
};

export class SignalingServer extends TypedEventTarget<ServerEventMap> {
	state: ConnectionState = "disconnected";
	#config: Config;
	#ws: WebSocket | undefined = undefined;
	#currentID: number = 0;
	#transactions: Map<string, Transaction<keyof typeof RequestResponseMap>> =
		new Map();
	#reconnectAttempts: number = 0;
	#reconnectTimeout: number | undefined = undefined;
	#pingTimer: number | undefined = undefined;
	#destroyed: boolean = false;

	constructor(conf: Config) {
		super();
		this.#config = conf;
		this.#setState("connecting");
		this.#ws = this.#createSocket();
	}

	#createSocket(): WebSocket {
		const session = getSessionData();
		this.#ws = new WebSocket(
			`${this.#config.url}${session ? "?s=" + stringToBase64(JSON.stringify(session)) : ""}`,
		);
		this.#ws.addEventListener("open", this.#onopen);
		this.#ws.addEventListener("close", this.#onclose);
		this.#ws.addEventListener("message", this.#onmessage);
		this.#ws.addEventListener("error", this.#onerror);
		// ping
		this.#ws.addEventListener("open", () => {
			this.#pingTimer = setInterval(() => {
				if (this.#destroyed || this.#ws?.readyState !== WebSocket.OPEN) {
					clearInterval(this.#pingTimer);
					return;
				}
				this.send({ type: "ping" }).catch((err) => console.error("ping:", err));
			}, this.#config.pingInterval);
		});
		this.#ws.addEventListener("close", () => {
			clearInterval(this.#pingTimer);
			this.#pingTimer = undefined;
		});
		return this.#ws;
	}

	#setState(v: ConnectionState) {
		this.state = v;
		$connectionState.set(v);
	}

	async connect(): Promise<WebSocket> {
		if (this.#destroyed) {
			throw new Error("instance has been destroyed");
		}
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
			this.#setState("connecting");
			this.#ws = this.#createSocket();

			await waitForOpen(this.#ws);

			this.#reconnectAttempts = 0;
			clearTimeout(this.#reconnectTimeout);
			this.#reconnectTimeout = undefined;

			return this.#ws;
		} catch (err) {
			this.#setState("failed");
			throw err;
		}
	}

	#reconnect() {
		if (this.#reconnectTimeout || this.#destroyed) {
			return;
		}

		const { minReconnectDelay, maxReconnectDelay } = this.#config;
		const delay = calculateDelay(
			this.#reconnectAttempts,
			minReconnectDelay,
			maxReconnectDelay,
		);
		this.#reconnectAttempts += 1;
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
		this.state = "disconnected";
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
		if (this.#destroyed) {
			throw new Error("instance has been destroyed");
		}
		if (this.#ws?.readyState !== WebSocket.OPEN) {
			throw new Error("socket not open");
		}

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
		}, 8000);

		const cleanup = () => {
			clearTimeout(timeout);
			this.#transactions.delete(id);
		};

		const promise = new Promise<ResponseMap[Req["type"]]>((resolve, reject) => {
			tx.resolve = (v) => {
				cleanup();
				resolve(v);
			};
			tx.reject = (v) => {
				cleanup();
				reject(v);
			};
		});

		this.#transactions.set(id, tx);
		this.#ws.send(JSON.stringify(msg));

		return promise;
	}

	async send(msg: OutgoingMessage) {
		if (this.#destroyed) {
			throw new Error("instance has been destroyed");
		}
		if (this.#ws?.readyState !== WebSocket.OPEN) {
			throw new Error("socket not open");
		}
		this.#ws.send(JSON.stringify(msg));
	}

	#onerror = (e: Event) => {
		this.#setState("failed");
		console.error("WebSocket error: " + JSON.stringify(e));
	};

	#onopen = () => {
		this.#setState("connected");
	};

	#onclose = () => {
		this.#setState("disconnected");
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
					setSessionData({ username: message.payload.username });
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

	#dispatchMessageEvent(message: IncomingMessage) {
		const event: ServerEvent = new CustomEvent(message.type, {
			detail: message.payload,
		});
		this.dispatchTypedEvent(message.type, event);
	}
}

export function subscribe<E extends keyof ServerEventMap>(
	target: SignalingServer,
	evt: E,
	handler: (e: ServerEventMap[E]) => void,
): () => void {
	target.addEventListener(evt, handler);
	return () => target.removeEventListener(evt, handler);
}

function calculateDelay(attempt: number, base: number, max: number): number {
	const delay = Math.min(base * 2 ** attempt, max);
	const jitter = delay * 0.15 * Math.random();
	return delay + jitter;
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

export function createServer(conf: Config): SignalingServer {
	window.__WEBSEND_SERVER?.destroy();
	window.__WEBSEND_SERVER = new SignalingServer(conf);
	return window.__WEBSEND_SERVER;
}
