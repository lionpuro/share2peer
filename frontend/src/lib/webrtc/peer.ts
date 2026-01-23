import { map } from "nanostores";
import { TypedEventTarget } from "typescript-event-target";
import { $identity } from "#/lib/server";
import { $session } from "#/lib/session";
import { $uploads, getUpload, type FileMetadata } from "#/lib/file";
import type { Client } from "#/lib/schemas";
import {
	CancelShareSchema,
	createDataChannel,
	ReadyToReceiveSchema,
	RequestFileSchema,
	ShareFilesSchema,
	type CancelShareMessage,
	type MessageChannelMessage,
	type ReadyToReceiveMessage,
	type RequestFileMessage,
	type ShareFilesMessage,
} from "./datachannel";
import {
	handleIncomingTransfer,
	handleStartTransfer,
	incoming,
	outgoing,
	stopTransfers,
} from "./transfer";

export type PeerState = Client & {
	files: FileMetadata[];
};

type PeerStore = Partial<Record<string, PeerState>>;

export const $peers = map<PeerStore>({});

function findPeer(id: string): PeerState | undefined {
	return $peers.get()[id];
}

function addPeer(peer: PeerState) {
	$peers.setKey(peer.id, peer);
}

function updatePeer(id: string, update: Partial<PeerState>) {
	const peers = $peers.get();
	const peer = peers[id];
	if (!peer) return;
	$peers.setKey(id, { ...peer, ...update });
}

function removePeer(id: string) {
	const peers = { ...$peers.get() };
	delete peers[id];
	$peers.set(peers);
}

function removePeers() {
	$peers.set({});
}

type PeerConnectionOptions = {
	onIceCandidate?: (candidate: RTCIceCandidate) => void;
};

type EventMap = {
	"ready-to-receive": CustomEvent<ReadyToReceiveMessage>;
	"share-files": CustomEvent<ShareFilesMessage>;
	"request-file": CustomEvent<RequestFileMessage>;
	"cancel-share": CustomEvent<CancelShareMessage>;
};

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
		const conn = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		conn.addEventListener("icecandidate", (e) => {
			if (!e.candidate) return;
			this.#options.onIceCandidate?.(e.candidate);
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
			try {
				handleIncomingTransfer(fileID, e.channel);
			} catch (err) {
				console.error("set up receive channel:", err);
			}
		});
		return conn;
	}

	#setupMessageChannel() {
		if (!this.channel) return;

		this.channel.binaryType = "arraybuffer";

		this.channel.addEventListener("open", () => {
			const identity = $identity.get();
			const session = $session.get();
			if (!identity || !session) return;
			const uploads = $uploads.get().length > 0;
			if (uploads) {
				return;
			}
			this.send({
				type: "ready-to-receive",
				payload: {
					client_id: identity.id,
				},
			});
		});
		this.channel.addEventListener("close", () => {
			console.log("message channel closed");
		});
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
				case "request-file":
					this.dispatchTypedEvent(
						data.type,
						new CustomEvent(data.type, {
							detail: RequestFileSchema.parse(data),
						}),
					);
					break;
				case "cancel-share":
					this.dispatchTypedEvent(
						data.type,
						new CustomEvent(data.type, {
							detail: CancelShareSchema.parse(data),
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

class PeerConnectionManager {
	peers: Map<string, PeerConnection> = new Map();

	getConnection(id: string): PeerConnection | undefined {
		return this.peers.get(id);
	}

	createConnection(
		client: Client,
		opt?: PeerConnectionOptions,
	): PeerConnection {
		const existing = this.peers.get(client.id);
		if (existing) {
			return existing;
		}

		const peer = new PeerConnection(client.id, opt);
		this.#attachEventListeners(peer);
		this.peers.set(peer.id, peer);
		addPeer({ ...client, files: [] });

		return peer;
	}

	removeConnection(id: string) {
		stopTransfers(
			incoming,
			incoming.findByPeer(id).map((t) => t.id),
		);
		stopTransfers(
			outgoing,
			outgoing.findByPeer(id).map((t) => t.id),
		);
		const peer = this.peers.get(id);
		peer?.destroy();
		this.peers.delete(id);
		removePeer(id);
	}

	reset() {
		stopTransfers(
			incoming,
			incoming.list().map((t) => t.id),
		);
		stopTransfers(
			outgoing,
			outgoing.list().map((t) => t.id),
		);
		this.peers.forEach((p) => p.destroy());
		this.peers.clear();
		removePeers();
	}

	#attachEventListeners(conn: PeerConnection) {
		conn.addEventListener("ready-to-receive", () => {
			const uploads = $uploads.get();
			if (uploads.length < 1) return;
			const files = uploads.map((u) => ({
				id: u.id,
				name: u.name,
				mime: u.mime,
				size: u.size,
			}));
			conn.send({ type: "share-files", payload: { files } });
		});

		conn.addEventListener("share-files", (e) => {
			stopTransfers(
				incoming,
				incoming.findByPeer(conn.id).map((t) => t.id),
			);
			const peer = findPeer(conn.id);
			if (!peer) return;
			updatePeer(peer.id, { ...peer, files: e.detail.payload.files });
		});

		conn.addEventListener("request-file", (e) => {
			const upload = getUpload(e.detail.payload.file_id);
			if (!upload) {
				console.error("requested file does not exist");
				return;
			}
			const { file, ...meta } = upload;
			handleStartTransfer(conn, meta.id, file).catch((err) =>
				console.error("failed to send file:", err),
			);
		});

		conn.addEventListener("cancel-share", () => {
			stopTransfers(
				incoming,
				incoming.findByPeer(conn.id).map((t) => t.id),
			);
			const peer = findPeer(conn.id);
			if (!peer) return;
			updatePeer(peer.id, { files: [] });
		});
	}
}

export const peers = new PeerConnectionManager();
