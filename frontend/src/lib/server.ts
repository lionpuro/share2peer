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
		__SignalingServer: SignalingServer | undefined;
	}
}

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;

type Transaction<Type extends keyof typeof RequestResponseMap> = {
	action: Type;
	resolve: (value: Message) => void;
	reject: (reason?: unknown) => void;
};

type PendingTransaction =
	| Transaction<"join-room">
	| Transaction<"leave-room">
	| Transaction<"create-room">;

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
	#reconnectAttempts: number = 0;
	#reconnectTimeout: number | undefined = undefined;
	#clientDisconnect: boolean = false;

	constructor(url: string) {
		super();
		this.#url = url;
		window.__SignalingServer?.disconnect();
		window.__SignalingServer = this;
		this.connect().catch((err) => console.error(err));
	}

	async connect(): Promise<WebSocket> {
		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			return this.#ws;
		}

		try {
			$connectionState.set("connecting");
			this.#ws = await openSocket(this.#url);
			this.#reconnectAttempts = 0;
			this.#clientDisconnect = false;
			clearTimeout(this.#reconnectTimeout);
			this.#reconnectTimeout = undefined;
			$connectionState.set("connected");

			this.#ws.addEventListener("error", this.#onerror);
			this.#ws.addEventListener("close", this.#onclose);
			this.#ws.addEventListener("message", this.#onmessage);

			return this.#ws;
		} catch (err) {
			$connectionState.set("failed");
			throw err;
		}
	}

	#reconnect() {
		if (this.#reconnectTimeout) {
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
				if (!this.#clientDisconnect) {
					this.#reconnect();
				}
			});
		}, delay);
	}

	disconnect() {
		this.#clientDisconnect = true;
		clearTimeout(this.#reconnectTimeout);
		this.#reconnectTimeout = undefined;
		if (this.#ws) {
			this.#ws.close();
			this.#ws = undefined;
		}
		$connectionState.set("disconnected");
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

	#onerror = (e: Event) => {
		$connectionState.set("failed");
		console.error("WebSocket error: " + JSON.stringify(e));
	};

	#onclose = () => {
		$connectionState.set("disconnected");
		removeConnections();
		closeRoom();
		this.dispatchTypedEvent("close", new CustomEvent("close"));
		if (!this.#clientDisconnect) {
			this.#reconnect();
		}
	};

	#onmessage = async (e: MessageEvent) => {
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
				case "network-users":
					$networkUsers.set(body.payload.users);
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
				case "room-info":
					handleRoomInfo(body.payload);
					break;
				case "room-left":
					handleRoomLeft();
					break;
				case "user-joined":
					await handleUserJoined(this, body.payload);
					break;
				case "user-left":
					handleUserLeft(body.payload);
					break;
			}
			this.#dispatchMessageEvent(body);
		} catch (err) {
			console.error(err);
		}
	};

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

function resolveSocketURL(): string {
	const { VITE_WS_PROTOCOL, VITE_WS_HOST, VITE_WS_ENDPOINT } = import.meta.env;
	const host = VITE_WS_HOST.startsWith("localhost:")
		? new URL(import.meta.url).host
		: VITE_WS_HOST;

	return new URL(VITE_WS_ENDPOINT, `${VITE_WS_PROTOCOL}://${host}`).toString();
}

export const server = new SignalingServer(resolveSocketURL());
