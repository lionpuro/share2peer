import { $peer, createPeer, type Peer } from "./peer";
import { $session } from "../session";
import { $identity, type WebSocketManager } from "../socket";
import {
	MessageType,
	type AnswerMessage,
	type ICECandidateMessage,
	type OfferMessage,
} from "../message";
import {
	$uploads,
	sendFile,
	stopTransfer,
	shareUploads,
	downloadManager,
} from "../file";
import {
	DataChannelEvents,
	RequestFileSchema,
	sendToChannel,
	ShareFilesSchema,
	type RequestFileMessage,
	type ShareFilesMessage,
} from "./datachannel";
import { decodeChunk } from "./protocol";

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
		try {
			if (e.data instanceof ArrayBuffer) {
				if (!downloadManager.current) {
					console.error("received chunk without metadata");
					return;
				}
				downloadManager.handleChunk(decodeChunk(e.data as ArrayBuffer));
				return;
			}
			if (typeof e.data !== "string") {
				return;
			}
			const data = JSON.parse(e.data) as unknown;
			if (!data || typeof data !== "object" || !("type" in data)) {
				console.warn("data channel: invalid message format");
				return;
			}
			switch (data.type) {
				case DataChannelEvents.ReadyToReceive:
					handleReadyToReceive(peer);
					break;
				case DataChannelEvents.ShareFiles:
					handleShareFiles(ShareFilesSchema.parse(data));
					break;
				case DataChannelEvents.RequestFile:
					await handleRequestFile(peer, RequestFileSchema.parse(data));
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

function handleReadyToReceive(peer: Peer) {
	const uploads = $uploads.get();
	if ($uploads.get().length < 1) {
		return;
	}
	const files = uploads.map((u) => ({
		id: u.id,
		name: u.name,
		mime: u.mime,
		size: u.size,
	}));
	sendToChannel(peer.dataChannel, {
		type: "share-files",
		payload: { files },
	});
}

function handleShareFiles(data: ShareFilesMessage) {
	stopTransfer();
	downloadManager.setFiles(data.payload.files);
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: data.payload.files });
}

async function handleRequestFile(peer: Peer, data: RequestFileMessage) {
	const uploads = $uploads.get();
	const upload = uploads.find((f) => f.id === data.payload.file_id);
	if (!upload) {
		if (uploads.length > 0) {
			shareUploads(uploads);
		}
		return;
	}
	const { file, ...meta } = upload;
	sendFile(peer.dataChannel, file, meta);
}

function handleCancelShare() {
	stopTransfer();
	downloadManager.reset();
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
