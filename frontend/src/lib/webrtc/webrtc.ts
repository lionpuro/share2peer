import {
	MessageType,
	type AnswerMessage,
	type ICECandidateMessage,
	type OfferMessage,
} from "#/lib/schemas";
import { $identity, type WebSocketManager } from "#/lib/socket";
import { $session } from "#/lib/session";
import { $uploads, getUpload, type FileMetadata } from "#/lib/file";
import {
	$peers,
	addPeer,
	createPeer,
	findPeer,
	removePeer,
	removePeers,
	updatePeer,
	type Peer,
} from "./peer";
import {
	SignalChannelEvents,
	RequestFileSchema,
	sendSignal,
	ShareFilesSchema,
	type DataChannelType,
	type RequestFileMessage,
	type ShareFilesMessage,
	type SignalChannelMessage,
} from "./datachannel";
import {
	incoming,
	outgoing,
	handleIncomingTransfer,
	handleStartTransfer,
	stopTransfers,
} from "./transfer";

export async function createOffer(socket: WebSocketManager, target: string) {
	const session = $session.get();
	const identity = $identity.get();
	if (!session || !identity) {
		return;
	}
	const client = session.clients?.find((c) => c.id === target);
	if (!client || findPeer(client.id) !== undefined) {
		return;
	}
	const peer = createPeer(client);
	peer.signalChannel = peer.connection.createDataChannel(
		"signal" satisfies DataChannelType,
	);
	peer.signalChannel.binaryType = "arraybuffer";
	addPeer(peer);
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
	const session = $session.get();
	const identity = $identity.get();
	if (!session || !identity) return;
	const client = session.clients?.find((c) => c.id === msg.payload.from);
	if (!client) return;

	const peer = createPeer(client);
	addPeer(peer);
	registerPeerConnectionListeners(peer, socket);

	await peer.connection
		.setRemoteDescription(msg.payload.offer)
		.catch(console.error);
	const answer = await peer.connection.createAnswer();
	await peer.connection.setLocalDescription(answer);

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
	const peer = findPeer(msg.payload.from);
	if (!peer) {
		console.error("handle answer: connection not found");
		return;
	}
	await peer.connection
		.setRemoteDescription(msg.payload.answer)
		.catch(console.error);
}

export async function handleICECandidate(msg: ICECandidateMessage) {
	const peer = findPeer(msg.payload.from);
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
		const fileID = e.channel.label.slice(5);
		try {
			handleIncomingTransfer(fileID, e.channel);
		} catch (err) {
			console.error("set up receive channel:", err);
		}
	});
}

function setupSignalChannel(peer: Peer) {
	if (!peer.signalChannel) return;
	peer.signalChannel.addEventListener("open", () => {
		const identity = $identity.get();
		const session = $session.get();
		if (!identity || !session) return;
		const uploads = $uploads.get().length > 0;
		if (uploads) {
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
					handleReadyToReceive(peer.id);
					break;
				case SignalChannelEvents.ShareFiles:
					handleShareFiles(peer.id, ShareFilesSchema.parse(data));
					break;
				case SignalChannelEvents.RequestFile:
					await handleRequestFile(peer.id, RequestFileSchema.parse(data));
					break;
				case SignalChannelEvents.CancelShare:
					handleCancelShare(peer.id);
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

function handleReadyToReceive(peerID: string) {
	const peer = findPeer(peerID);
	if (!peer || !peer.signalChannel) return;
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
	sendSignal(peer.signalChannel, { type: "share-files", payload: { files } });
}

function handleShareFiles(sender: string, data: ShareFilesMessage) {
	stopTransfers(
		incoming,
		incoming.findByPeer(sender).map((t) => t.id),
	);
	const peer = findPeer(sender);
	if (!peer) return;
	updatePeer(peer.id, { ...peer, files: data.payload.files });
}

async function handleRequestFile(sender: string, data: RequestFileMessage) {
	const peer = findPeer(sender);
	if (!peer) return;
	const upload = getUpload(data.payload.file_id);
	if (!upload) {
		console.error("requested file does not exist");
		return;
	}
	const { file, ...meta } = upload;
	try {
		handleStartTransfer(peer.id, meta.id, file);
	} catch (err) {
		console.error("failed to send file:", err);
	}
}

function handleCancelShare(sender: string) {
	stopTransfers(
		incoming,
		incoming.findByPeer(sender).map((t) => t.id),
	);
	const peer = findPeer(sender);
	if (!peer) return;
	updatePeer(peer.id, { files: [] });
}

export function closePeerConnection(peerID: string) {
	stopTransfers(
		incoming,
		incoming.findByPeer(peerID).map((t) => t.id),
	);
	stopTransfers(
		outgoing,
		outgoing.findByPeer(peerID).map((t) => t.id),
	);
	const peer = findPeer(peerID);
	if (!peer) return;
	peer.signalChannel?.close();
	peer.connection.close();
	removePeer(peer.id);
}

export function closePeerConnections() {
	stopTransfers(
		incoming,
		incoming.list().map((t) => t.id),
	);
	stopTransfers(
		outgoing,
		outgoing.list().map((t) => t.id),
	);
	$peers.get().forEach((p) => {
		p.signalChannel?.close();
		p.connection.close();
	});
	removePeers();
}

export function shareFiles(files: FileMetadata[]) {
	sendToPeers({ type: "share-files", payload: { files } });
}

export function sendCancelShare() {
	$peers.get().forEach((p) => {
		if (!p.signalChannel) {
			return;
		}
		sendSignal(p.signalChannel, { type: "cancel-share" });
	});
}

export function sendToPeers(msg: SignalChannelMessage) {
	const session = $session.get();
	if (!session) return;
	session.clients?.forEach((c) => {
		const peer = findPeer(c.id);
		if (peer && peer.signalChannel) {
			sendSignal(peer.signalChannel, msg);
		}
	});
}
