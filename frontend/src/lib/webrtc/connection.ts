import { TypedEventTarget } from "typescript-event-target";
import type { User } from "#/lib/schemas";
import {
	createDataChannel,
	ReadyToReceiveSchema,
	ShareFilesSchema,
	type MessageChannelMessage,
	type ReadyToReceiveMessage,
	type ShareFilesMessage,
} from "./datachannel";
import { startUpload, stopTransfer } from "./transfer";
import { findTransfersByPeer, listTransfers } from "#/stores/transfer";
import {
	addPeer,
	findPeer,
	removePeer,
	removePeers,
	updatePeer,
} from "#/stores/peer";
import { $uploads } from "#/stores/file";
import { $identity, $room } from "#/stores/signaling";

export type ConnectionState =
	"disconnected" | "connecting" | "connected" | "failed";

type PeerConnectionOptions = {
	onIceCandidate?: (candidate: RTCIceCandidate) => void;
};

type EventMap = {
	"ready-to-receive": CustomEvent<ReadyToReceiveMessage>;
	"share-files": CustomEvent<ShareFilesMessage>;
};

function rtcConfig(): RTCConfiguration {
	const servers = import.meta.env.VITE_ICE_SERVERS.split(",");
	return {
		iceServers: [{ urls: servers }],
	};
}

export class PeerConnection extends TypedEventTarget<EventMap> {
	id: string;
	connection: RTCPeerConnection;
	channel: RTCDataChannel | undefined;
	#options: PeerConnectionOptions;

	constructor(id: string, opt: PeerConnectionOptions = {}) {
		super();
		this.id = id;
		this.connection = this.#createConnection();
		this.#options = opt;
	}

	#createConnection(): RTCPeerConnection {
		const conn = new RTCPeerConnection(rtcConfig());
		conn.addEventListener("icecandidate", (e) => {
			if (!e.candidate) return;
			this.#options.onIceCandidate?.(e.candidate);
		});
		conn.addEventListener("connectionstatechange", () => {
			updatePeer(this.id, { connectionState: this.state() });
		});
		conn.addEventListener("datachannel", (e) => {
			if (e.channel.label === "messages") {
				this.channel = e.channel;
				this.#setupMessageChannel();
				return;
			}
			if (!e.channel.label.startsWith("file-")) {
				console.warn("unknown datachannel type:", e.channel.label);
				return;
			}
			const fileID = e.channel.label.slice(5);
			startUpload(e.channel, this.id, fileID);
		});
		return conn;
	}

	#setupMessageChannel() {
		if (!this.channel) return;

		this.channel.binaryType = "arraybuffer";

		this.channel.addEventListener("open", () => {
			const identity = $identity.get();
			const room = $room.get();
			if (!identity || !room) return;
			const uploads = $uploads.get().length > 0;
			if (uploads) {
				return;
			}
			this.send({
				type: "ready-to-receive",
				payload: {
					user_id: identity.id,
				},
			});
		});
		this.channel.addEventListener("close", () => {});
		this.channel.addEventListener("message", (e) => {
			this.#onMessage(e);
		});
	}

	createMessageChannel() {
		this.channel = createDataChannel(this.connection, "messages");
		this.#setupMessageChannel();
	}

	async createFileChannel(fileID: string): Promise<RTCDataChannel> {
		return new Promise((resolve, reject) => {
			const chan = createDataChannel(this.connection, `file-${fileID}`);
			const timeout = setTimeout(() => {
				reject("create channel timed out");
			}, 5 * 1000);
			chan.addEventListener("open", () => {
				clearTimeout(timeout);
				resolve(chan);
			});
		});
	}

	async #onMessage(e: MessageEvent) {
		try {
			if (typeof e.data !== "string") {
				return;
			}
			const data = JSON.parse(e.data) as unknown;
			if (!data || typeof data !== "object" || !("type" in data)) {
				console.warn("data channel: invalid message format");
				return;
			}
			switch (data.type) {
				case "ready-to-receive":
					this.dispatchTypedEvent(
						data.type,
						new CustomEvent(data.type, {
							detail: ReadyToReceiveSchema.parse(data),
						}),
					);
					break;
				case "share-files":
					this.dispatchTypedEvent(
						data.type,
						new CustomEvent(data.type, {
							detail: ShareFilesSchema.parse(data),
						}),
					);
					break;
				default:
					console.warn(
						"datachannel message: unrecognized message type:",
						data.type,
					);
					break;
			}
		} catch (err) {
			console.error(err);
		}
	}

	async createOffer(): Promise<RTCSessionDescriptionInit> {
		const offer = await this.connection.createOffer();
		await this.connection.setLocalDescription(offer);
		return offer;
	}

	async createAnswer(): Promise<RTCSessionDescriptionInit> {
		const answer = await this.connection.createAnswer();
		await this.connection.setLocalDescription(answer);
		return answer;
	}

	async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
		await this.connection.setRemoteDescription(desc);
	}

	async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
		await this.connection.addIceCandidate(candidate);
	}

	state(): ConnectionState {
		switch (this.connection.connectionState) {
			case "connecting":
			case "connected":
			case "failed":
				return this.connection.connectionState;
			case "closed":
			case "disconnected":
				return "disconnected";
			case "new":
				return "connecting";
		}
	}

	send(msg: MessageChannelMessage) {
		if (!this.channel || this.channel.readyState !== "open") {
			console.warn("message channel not open");
			return;
		}
		this.channel.send(JSON.stringify(msg));
	}

	destroy() {
		this.channel?.close();
		this.connection.close();
	}
}

const connections: Map<string, PeerConnection> = new Map();

export function findConnection(id: string): PeerConnection | undefined {
	return connections.get(id);
}

export function createConnection(
	user: User,
	opt?: PeerConnectionOptions,
): PeerConnection {
	const existing = connections.get(user.id);
	if (existing) {
		return existing;
	}

	const conn = new PeerConnection(user.id, opt);

	conn.addEventListener("ready-to-receive", () => {
		const uploads = $uploads.get();
		const files = uploads.map((u) => ({
			id: u.id,
			name: u.name,
			mime: u.mime,
			size: u.size,
		}));
		conn.send({ type: "share-files", payload: { files } });
	});

	conn.addEventListener("share-files", (e) => {
		findTransfersByPeer(conn.id).forEach(
			(t) => t.type === "download" && stopTransfer(t),
		);
		const peer = findPeer(conn.id);
		if (!peer) return;
		updatePeer(peer.id, { ...peer, files: e.detail.payload.files });
	});

	connections.set(conn.id, conn);
	addPeer({ ...user, connectionState: conn.state() });

	return conn;
}

export function removeConnection(id: string) {
	findTransfersByPeer(id).forEach((t) => stopTransfer(t));
	const conn = connections.get(id);
	conn?.destroy();
	connections.delete(id);
	removePeer(id);
}

export function removeConnections() {
	listTransfers().forEach((t) => stopTransfer(t));
	connections.forEach((p) => p.destroy());
	connections.clear();
	removePeers();
}

export function broadcast(msg: MessageChannelMessage) {
	$room.get()?.users?.forEach((u) => connections.get(u.id)?.send(msg));
}
