import { TypedEventTarget } from "typescript-event-target";
import {
	RequestResponseMap,
	type IncomingMessage,
	type OutgoingMessage,
} from "#/lib/schemas/signaling";
import {
	$connectionState,
	$identity,
	$networkUsers,
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
import { Socket, type SocketEvent } from "./socket";

declare global {
	interface Window {
		__WEBSEND_CLIENT: SignalingClient | undefined;
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

export type SignalingEventMap = {
	[M in IncomingMessage as M["type"]]: CustomEvent<M["payload"]>;
} & {
	disconnect: CustomEvent;
};

export type SignalingEvent<E extends keyof SignalingEventMap> =
	SignalingEventMap[E];

type ConnectionState = ReturnType<typeof $connectionState.get>;

export class SignalingClient extends TypedEventTarget<SignalingEventMap> {
	state: ConnectionState = "disconnected";
	#socket: Socket;
	#currentID: number = 0;
	#transactions: Map<string, Transaction<keyof typeof RequestResponseMap>> =
		new Map();
	#destroyed: boolean = false;

	constructor(socket: Socket) {
		super();
		this.#socket = socket;
		socket.addEventListener("state", this.#onstate);
		socket.addEventListener("error", this.#onerror);
		socket.addEventListener("message", this.#onmessage);
	}

	#setState(v: ConnectionState) {
		this.state = v;
		if (!this.#destroyed) {
			$connectionState.set(v);
		}
	}

	destroy() {
		this.#destroyed = true;
		this.#socket.destroy();
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
		if (this.state !== "connected") {
			throw new Error("socket not connected");
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

		await this.#socket.send(msg);

		return promise;
	}

	async send(msg: OutgoingMessage) {
		if (this.#destroyed) {
			throw new Error("instance has been destroyed");
		}
		await this.#socket.send(msg);
	}

	#onstate = (e: SocketEvent<"state">) => {
		const state = e.detail;
		this.state = state;
		$connectionState.set(state);

		switch (state) {
			case "disconnected":
				$identity.set(undefined);
				removeConnections();
				closeRoom();
				break;
		}
	};

	#onmessage = async (e: SocketEvent<"message">) => {
		try {
			const message = e.detail;
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
					this.#setState("connected");
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

	#onerror = (e: SocketEvent<"error">) => {
		console.error(e.detail);
	};

	#dispatchMessageEvent(message: IncomingMessage) {
		const event: SignalingEventMap[keyof SignalingEventMap] = new CustomEvent(
			message.type,
			{
				detail: message.payload,
			},
		);
		this.dispatchTypedEvent(message.type, event);
	}
}

export function subscribe<E extends keyof SignalingEventMap>(
	target: SignalingClient,
	evt: E,
	handler: (e: SignalingEventMap[E]) => void,
): () => void {
	target.addEventListener(evt, handler);
	return () => target.removeEventListener(evt, handler);
}

export function createSignalingClient(url: string): SignalingClient {
	window.__WEBSEND_CLIENT?.destroy();
	const socket = new Socket({
		url: url,
		pingInterval: 55 * 1000,
		minReconnectDelay: 1000,
		maxReconnectDelay: 15 * 1000,
	});
	window.__WEBSEND_CLIENT = new SignalingClient(socket);
	return window.__WEBSEND_CLIENT;
}
