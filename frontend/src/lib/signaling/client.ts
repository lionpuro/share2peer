import { EventEmitter } from "#/lib/events";
import {
	RequestResponseMap,
	type IncomingMessage,
	type OutgoingMessage,
} from "#/lib/schemas/signaling";
import {
	$connectionState,
	$identity,
	$networkUsers,
	$room,
	setSessionData,
	type SocketState,
} from "#/stores/signaling";
import {
	createPeerConnection,
	handleAnswer,
	handleICECandidate,
	handleOffer,
	removeConnection,
	removeConnections,
} from "#/lib/webrtc";
import { Socket, type SocketEvent } from "#/lib/signaling/socket";
import type { Room } from "#/lib/schemas";
import { setUploads } from "#/stores/file";

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

type SignalingEventMap = {
	[K in IncomingMessage["type"]]: IncomingMessage<K>;
};

export type SignalingEvent<
	K extends keyof SignalingEventMap = keyof SignalingEventMap,
> = { [P in K]: { type: P } & SignalingEventMap[P] }[K];

export class SignalingClient extends EventEmitter<SignalingEventMap> {
	state: SocketState = "disconnected";
	#roomState: "idle" | "joining" | "active" | "failed" = "idle";
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

	#setState(v: SocketState) {
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

	async joinRoom(id: string): Promise<Room> {
		if (this.#roomState === "joining") {
			throw new Error("already joining a room");
		}

		await this.leaveRoom();

		try {
			this.#roomState = "joining";
			const resp = await this.request({
				type: "join-room",
				payload: { room_id: id },
			});
			this.#roomState = "active";
			$room.set(resp.payload);
			return resp.payload;
		} catch (err) {
			this.#roomState = "failed";
			throw err;
		}
	}

	async leaveRoom() {
		const room = $room.get();
		if (!room || (this.state !== "connected" && this.state !== "connecting")) {
			return;
		}
		await this.request({
			type: "leave-room",
			payload: { room_id: room.id },
		}).catch(console.error);
		$room.set(undefined);
		this.#roomState = "idle";
		removeConnections();
		setUploads([]);
	}

	async createRoom(): Promise<Room> {
		this.#roomState = "idle";
		await this.leaveRoom();
		const resp = await this.request({
			type: "create-room",
		});
		return resp.payload;
	}

	#onstate = (e: SocketEvent<"state">) => {
		const state = e.detail;
		this.state = state;
		$connectionState.set(state);

		switch (state) {
			case "disconnected":
				$identity.set(undefined);
				removeConnections();
				$room.set(undefined);
				this.#roomState = "idle";
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
				case "room-state":
					$room.set(message.payload);
					break;
				case "room-left":
					$room.set(undefined);
					this.#roomState = "idle";
					removeConnections();
					setUploads([]);
					break;
				case "user-joined":
					await createPeerConnection(this, message.payload);
					break;
				case "user-left":
					removeConnection(message.payload.id);
					break;
			}
			this.#dispatchMessage(message);
		} catch (err) {
			console.error("handle message:", err);
		}
	};

	#onerror = (e: SocketEvent<"error">) => {
		console.error(e.detail);
	};

	#dispatchMessage<K extends keyof SignalingEventMap>(e: SignalingEvent<K>) {
		const dispatch = <K extends keyof SignalingEventMap>(
			e: SignalingEvent<K>,
		) => {
			this.dispatchEvent(e.type, e);
		};
		const dispatchers: {
			[K in keyof SignalingEventMap]: (e: SignalingEvent<K>) => void;
		} = {
			error: dispatch,
			identity: dispatch,
			"room-state": dispatch,
			"user-joined": dispatch,
			"user-left": dispatch,
			offer: dispatch,
			answer: dispatch,
			"ice-candidate": dispatch,
			"room-created": dispatch,
			"room-joined": dispatch,
			"room-left": dispatch,
			"network-users": dispatch,
			"room-invitation": dispatch,
		};
		dispatchers[e.type](e);
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
