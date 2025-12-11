import { atom } from "nanostores";
import * as z from "zod/mini";
import { $session } from "./session";
import { $identity, type WebSocketManager } from "./socket";
import {
	MessageType,
	type AnswerMessage,
	type ICECandidateMessage,
	type OfferMessage,
} from "./message";
import {
	$downloadState,
	$uploads,
	setDownloads,
	FileMetadataSchema,
	saveChunk,
	sendFile,
	type FileMetadata,
	stopTransfer,
	shareUploads,
} from "./file";

export type Peer = {
	id: string;
	connection: RTCPeerConnection;
	dataChannel?: RTCDataChannel;
	files: FileMetadata[];
};

function createPeer(id: string): Peer {
	const peer: Peer = {
		id: id,
		connection: new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		}),
		files: [],
	};
	return peer;
}

export const $peer = atom<Peer | null>(null);

export function sendToPeer(peer: Peer, msg: DataChannelMessage) {
	if (!peer.dataChannel) {
		console.warn("data channel doesn't exist");
		return;
	}
	peer.dataChannel.send(JSON.stringify(msg));
}

const DataChannelEvents = {
	ShareFiles: "share-files",
	RequestFile: "request-file",
	CancelShare: "cancel-share",
	ReadyToReceive: "ready-to-receive",
} as const;

export type DataChannelMessageType =
	(typeof DataChannelEvents)[keyof typeof DataChannelEvents];

export const ShareFilesSchema = z.object({
	type: z.literal(DataChannelEvents.ShareFiles),
	payload: z.object({ files: z.array(FileMetadataSchema) }),
});

export type ShareFilesMessage = z.infer<typeof ShareFilesSchema>;

export const RequestFileSchema = z.object({
	type: z.literal(DataChannelEvents.RequestFile),
	payload: z.object({ file_id: z.string() }),
});

export type RequestFileMessage = z.infer<typeof RequestFileSchema>;

export const CancelShareSchema = z.object({
	type: z.literal(DataChannelEvents.CancelShare),
});

export type CancelShareMessage = z.infer<typeof CancelShareSchema>;

export const ReadyToReceiveSchema = z.object({
	type: z.literal(DataChannelEvents.ReadyToReceive),
	payload: z.object({ client_id: z.string() }),
});

export type ReadyToReceiveMessage = z.infer<typeof ReadyToReceiveSchema>;

export type DataChannelMessage =
	| ShareFilesMessage
	| RequestFileMessage
	| CancelShareMessage
	| ReadyToReceiveMessage;

export const RTCSessionDescriptionInitSchema = z.object({
	type: z.union([
		z.literal("answer"),
		z.literal("offer"),
		z.literal("pranswer"),
		z.literal("rollback"),
	]),
	sdp: z.optional(z.string()),
});

export const RTCIceCandidateSchema = z.object({
	candidate: z.optional(z.string()),
	sdpMid: z.optional(z.union([z.string(), z.null()])),
	sdpMLineIndex: z.optional(z.union([z.number(), z.null()])),
	usernameFragment: z.optional(z.union([z.string(), z.null()])),
});

export async function createOffer(socket: WebSocketManager, target: string) {
	const session = $session.get();
	const identity = $identity.get();
	if (!session || !identity) {
		return;
	}
	if ($peer.get()?.id === target) {
		return;
	}
	const peer = createPeer(target);
	$peer.set(peer);
	peer.dataChannel = peer.connection.createDataChannel("files");
	peer.dataChannel.binaryType = "arraybuffer";

	registerPeerConnectionListeners(peer, socket);
	registerDataChannelListeners(peer);

	const offer = await peer.connection.createOffer();
	await peer.connection.setLocalDescription(offer);

	const msg: OfferMessage = {
		type: MessageType.Offer,
		payload: {
			session_id: session.id,
			offer: offer,
			from: identity.id,
			to: target,
		},
	};

	socket.send(msg);
}

export async function handleOffer(socket: WebSocketManager, msg: OfferMessage) {
	const peer = createPeer(msg.payload.from);
	$peer.set(peer);

	registerPeerConnectionListeners(peer, socket);

	await peer.connection
		.setRemoteDescription(msg.payload.offer)
		.catch(console.error);
	const answer = await peer.connection.createAnswer();
	await peer.connection.setLocalDescription(answer);

	const session = $session.get();
	const identity = $identity.get();
	if (!session || !identity) return;

	const message: AnswerMessage = {
		type: MessageType.Answer,
		payload: {
			session_id: session.id,
			answer: answer,
			from: identity.id,
			to: msg.payload.from,
		},
	};

	socket.send(message);
}

export async function handleAnswer(msg: AnswerMessage) {
	const peer = $peer.get();
	if (!peer) {
		console.error("handle answer: connection not found");
		return;
	}
	await peer.connection
		.setRemoteDescription(msg.payload.answer)
		.catch(console.error);
}

export async function handleICECandidate(msg: ICECandidateMessage) {
	const peer = $peer.get();
	if (!peer) {
		console.error("handle ice candidate: connection not found");
		return;
	}
	await peer.connection
		.addIceCandidate(msg.payload.candidate)
		.catch(console.error);
}

function registerPeerConnectionListeners(peer: Peer, socket: WebSocketManager) {
	peer.connection.addEventListener("icecandidate", (e) => {
		const session = $session.get();
		const identity = $identity.get();
		if (!session || !identity) return;
		if (!e.candidate) return;
		const message: ICECandidateMessage = {
			type: MessageType.ICECandidate,
			payload: {
				session_id: session.id,
				candidate: e.candidate.toJSON(),
				from: identity.id,
				to: peer.id,
			},
		};
		socket.send(message);
	});
	peer.connection.addEventListener("iceconnectionstatechange", () => {
		if (peer.connection.connectionState === "failed") {
			peer.connection.restartIce();
		}
	});
	peer.connection.addEventListener("datachannel", (e) => {
		peer.dataChannel = e.channel;
		peer.dataChannel.binaryType = "arraybuffer";
		registerDataChannelListeners(peer);
	});
}

function registerDataChannelListeners(peer: Peer) {
	if (!peer.dataChannel) return;
	peer.dataChannel.addEventListener("open", () => {
		if ($uploads.get().length > 0) {
			return;
		}
		const msg = {
			type: DataChannelEvents.ReadyToReceive,
			payload: {
				client_id: $identity.get()?.id,
			},
		};
		peer.dataChannel?.send(JSON.stringify(msg));
	});
	peer.dataChannel.addEventListener("close", () => {
		console.log("data channel closed");
	});
	peer.dataChannel.addEventListener("message", async (e) => {
		if (e.data instanceof ArrayBuffer) {
			if (!$downloadState.get()) {
				console.error("received chunk without metadata");
				return;
			}
			saveChunk(e.data as ArrayBuffer);
			return;
		}
		if (typeof e.data !== "string") {
			return;
		}
		try {
			const data = JSON.parse(e.data) as unknown;
			if (!data || typeof data !== "object" || !("type" in data)) {
				console.warn("data channel: invalid message format");
				return;
			}
			switch (data.type) {
				case DataChannelEvents.ReadyToReceive:
					if ($uploads.get().length < 1) {
						return;
					}
					shareUploads($uploads.get());
					break;
				case DataChannelEvents.ShareFiles:
					handleShareFiles(ShareFilesSchema.parse(data));
					break;
				case DataChannelEvents.RequestFile:
					await handleRequestFile(RequestFileSchema.parse(data));
					break;
				case DataChannelEvents.CancelShare:
					handleCancelShare();
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
	});
}

function handleShareFiles(data: ShareFilesMessage) {
	stopTransfer();
	setDownloads(data.payload.files);
}

async function handleRequestFile(data: RequestFileMessage) {
	const uploads = $uploads.get();
	const upload = uploads.find((f) => f.id === data.payload.file_id);
	if (!upload) {
		if (uploads.length > 0) {
			shareUploads(uploads);
		}
		return;
	}
	const peer = $peer.get();
	if (!peer) return;
	await sendFile(peer, upload.file);
}

function handleCancelShare() {
	stopTransfer();
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: [] });
}

export function closePeerConnection() {
	stopTransfer();
	const peer = $peer.get();
	if (!peer) return;
	peer.connection.close();
	peer.dataChannel?.close();
	$peer.set(null);
}
