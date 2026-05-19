import { TypedEventTarget } from "typescript-event-target";
import {
	parseMessage,
	type IncomingMessage,
	type OutgoingMessage,
} from "#/lib/schemas/signaling";
import { getSessionData, type SocketState } from "#/stores/signaling";
import { stringToBase64 } from "#/lib/helper";

export type SocketEventMap = {
	message: CustomEvent<IncomingMessage>;
	state: CustomEvent<SocketState>;
	error: CustomEvent<Error>;
};

export type SocketEvent<E extends keyof SocketEventMap> = SocketEventMap[E];

type SocketConfig = {
	url: string;
	pingInterval: number;
	minReconnectDelay: number;
	maxReconnectDelay: number;
};

export class Socket extends TypedEventTarget<SocketEventMap> {
	state: SocketState = "disconnected";
	#config: SocketConfig;
	#ws: WebSocket | undefined = undefined;
	#reconnectAttempts: number = 0;
	#reconnectTimeout: number | undefined = undefined;
	#pingTimer: number | undefined = undefined;
	#destroyed: boolean = false;

	constructor(conf: SocketConfig) {
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
		return this.#ws;
	}

	#setState(v: SocketState) {
		this.state = v;
		if (!this.#destroyed) {
			this.dispatchTypedEvent("state", new CustomEvent("state", { detail: v }));
		}
	}

	async connect(): Promise<void> {
		if (this.#destroyed) {
			throw new Error("instance has been destroyed");
		}
		if (this.#ws?.readyState === WebSocket.OPEN) {
			return;
		}
		if (this.#ws?.readyState === WebSocket.CONNECTING) {
			return new Promise((resolve, reject) => {
				if (!this.#ws) {
					return reject(new Error("connection unavailable"));
				}
				this.#ws.addEventListener("open", () => {
					resolve();
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
		} catch (err) {
			this.#setState("disconnected");
			throw err;
		}
	}

	#scheduleReconnect() {
		if (this.#reconnectTimeout || this.#destroyed) {
			return;
		}
		const cfg = this.#config;
		const delay = calculateDelay(
			this.#reconnectAttempts,
			cfg.minReconnectDelay,
			cfg.maxReconnectDelay,
		);
		this.#reconnectAttempts += 1;
		this.#reconnectTimeout = setTimeout(() => {
			this.#reconnectTimeout = undefined;
			this.connect().catch(() => {
				if (!this.#destroyed) {
					this.#scheduleReconnect();
				}
			});
		}, delay);
	}

	destroy() {
		this.#destroyed = true;
		this.#setState("disconnected");
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
		this.dispatchTypedEvent(
			"error",
			new CustomEvent("error", {
				detail: new Error("WebSocket error: " + JSON.stringify(e)),
			}),
		);
	};

	#onopen = () => {
		this.#setState("connected");
		clearInterval(this.#pingTimer);
		this.#pingTimer = setInterval(() => {
			if (this.#destroyed || this.#ws?.readyState !== WebSocket.OPEN) {
				clearInterval(this.#pingTimer);
				return;
			}
			this.send({ type: "ping" }).catch((err) => console.error("ping:", err));
		}, this.#config.pingInterval);
	};

	#onclose = () => {
		this.#setState("disconnected");
		clearInterval(this.#pingTimer);

		this.#pingTimer = undefined;
		if (!this.#destroyed) {
			this.#scheduleReconnect();
		}
	};

	#onmessage = (e: MessageEvent) => {
		try {
			const message = parseMessage(e.data as unknown);
			this.dispatchTypedEvent(
				"message",
				new CustomEvent("message", { detail: message }),
			);
		} catch (err) {
			console.error("handle message:", err);
		}
	};
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
