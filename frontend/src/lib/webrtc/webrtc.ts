import { $session } from "#/lib/session";
import { $identity, type WebSocketManager } from "#/lib/socket";
import {
	MessageType,
	type AnswerMessage,
	type ICECandidateMessage,
	type OfferMessage,
} from "#/lib/message";
import { $uploads, getUpload, type FileMetadata } from "#/lib/file";
import { $peer, createPeer, type Peer } from "./peer";
import {
	SignalChannelEvents,
	RequestFileSchema,
	sendSignal,
	ShareFilesSchema,
	type DataChannelType,
	type RequestFileMessage,
	type ShareFilesMessage,
} from "./datachannel";
import {
	addFileChannel,
	createSendChannel,
	resetTransfers,
	setupReceiveChannel,
	transferFile,
} from "./transfer";

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
	peer.signalChannel = peer.connection.createDataChannel(
		"signal" satisfies DataChannelType,
	);
	peer.signalChannel.binaryType = "arraybuffer";
	$peer.set(peer);
	registerPeerConnectionListeners(peer, socket);
	setupSignalChannel(peer);

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
		if (e.channel.label === "signal") {
			peer.signalChannel = e.channel;
			peer.signalChannel.binaryType = "arraybuffer";
			setupSignalChannel(peer);
			return;
		}
		if (!e.channel.label.startsWith("file-")) {
			console.error("unknown datachannel type:", e.channel.label);
			return;
		}
		const id = e.channel.label.slice(5);
		try {
			const chan = setupReceiveChannel(e.channel, id);
			addFileChannel(id, { channel: chan, peer: peer.id });
		} catch (err) {
			console.error("set up receive channel:", err);
		}
	});
}

function setupSignalChannel(peer: Peer) {
	if (!peer.signalChannel) return;
	peer.signalChannel.addEventListener("open", () => {
		if ($uploads.get().length > 0) {
			return;
		}
		const msg = {
			type: SignalChannelEvents.ReadyToReceive,
			payload: {
				client_id: $identity.get()?.id,
			},
		};
		peer.signalChannel?.send(JSON.stringify(msg));
	});
	peer.signalChannel.addEventListener("close", () => {
		console.log("signalchannel closed");
	});
	peer.signalChannel.addEventListener("message", async (e) => {
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
				case SignalChannelEvents.ReadyToReceive:
					handleReadyToReceive(peer);
					break;
				case SignalChannelEvents.ShareFiles:
					handleShareFiles(ShareFilesSchema.parse(data));
					break;
				case SignalChannelEvents.RequestFile:
					await handleRequestFile(peer, RequestFileSchema.parse(data));
					break;
				case SignalChannelEvents.CancelShare:
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
	if (!peer.signalChannel) return;
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
	sendShareFiles(peer.signalChannel, files);
}

function handleShareFiles(data: ShareFilesMessage) {
	resetTransfers();
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: data.payload.files });
}

async function handleRequestFile(peer: Peer, data: RequestFileMessage) {
	const upload = getUpload(data.payload.file_id);
	if (!upload) {
		console.error("requested file does not exist");
		return;
	}
	const { file, ...meta } = upload;
	try {
		const chan = await createSendChannel(peer.connection, meta.id);
		addFileChannel(meta.id, { channel: chan, peer: peer.id });
		transferFile(chan, file, meta);
	} catch (err) {
		console.error("failed to send file:", err);
	}
}

function handleCancelShare() {
	resetTransfers();
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: [] });
}

export function closePeerConnection() {
	resetTransfers();
	const peer = $peer.get();
	if (!peer) return;
	peer.signalChannel?.close();
	peer.connection.close();
	$peer.set(null);
}

export function shareUploads() {
	const peer = $peer.get();
	if (!peer || !peer.signalChannel) return;
	const uploads = $uploads.get();
	const files = uploads.map((u) => ({
		id: u.id,
		name: u.name,
		mime: u.mime,
		size: u.size,
	}));
	sendShareFiles(peer.signalChannel, files);
}

function sendShareFiles(sigchan: RTCDataChannel, files: FileMetadata[]) {
	sendSignal(sigchan, {
		type: "share-files",
		payload: { files },
	});
}

export function sendCancelShare() {
	const peer = $peer.get();
	if (!peer) return;
	sendSignal(peer.signalChannel, { type: "cancel-share" });
}
