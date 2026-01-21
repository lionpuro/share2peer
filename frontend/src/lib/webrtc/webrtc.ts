import type {
	AnswerMessage,
	ICECandidateMessage,
	OfferMessage,
} from "#/lib/schemas";
import { $identity, type SignalingServer } from "#/lib/server";
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
	MessageChannelEvents,
	RequestFileSchema,
	sendMessage,
	ShareFilesSchema,
	type DataChannelType,
	type RequestFileMessage,
	type ShareFilesMessage,
	type MessageChannelMessage,
} from "./datachannel";
import {
	incoming,
	outgoing,
	handleIncomingTransfer,
	handleStartTransfer,
	stopTransfers,
} from "./transfer";

export async function createOffer(server: SignalingServer, target: string) {
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
	peer.messageChannel = peer.connection.createDataChannel(
		"messages" satisfies DataChannelType,
	);
	peer.messageChannel.binaryType = "arraybuffer";
	addPeer(peer);
	registerPeerConnectionListeners(peer, server);
	setupMessageChannel(peer);

	const offer = await peer.connection.createOffer();
	await peer.connection.setLocalDescription(offer);

	const msg: OfferMessage = {
		type: "offer",
		payload: {
			session_id: session.id,
			offer: offer,
			from: identity.id,
			to: target,
		},
	};

	server.send(msg);
}

export async function handleOffer(server: SignalingServer, msg: OfferMessage) {
	const session = $session.get();
	const identity = $identity.get();
	if (!session || !identity) return;
	const client = session.clients?.find((c) => c.id === msg.payload.from);
	if (!client) return;

	const peer = createPeer(client);
	addPeer(peer);
	registerPeerConnectionListeners(peer, server);

	await peer.connection
		.setRemoteDescription(msg.payload.offer)
		.catch(console.error);
	const answer = await peer.connection.createAnswer();
	await peer.connection.setLocalDescription(answer);

	const message: AnswerMessage = {
		type: "answer",
		payload: {
			session_id: session.id,
			answer: answer,
			from: identity.id,
			to: msg.payload.from,
		},
	};

	server.send(message);
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

function registerPeerConnectionListeners(peer: Peer, server: SignalingServer) {
	peer.connection.addEventListener("icecandidate", (e) => {
		const session = $session.get();
		const identity = $identity.get();
		if (!session || !identity) return;
		if (!e.candidate) return;
		const message: ICECandidateMessage = {
			type: "ice-candidate",
			payload: {
				session_id: session.id,
				candidate: e.candidate.toJSON(),
				from: identity.id,
				to: peer.id,
			},
		};
		server.send(message);
	});
	peer.connection.addEventListener("iceconnectionstatechange", () => {
		if (peer.connection.connectionState === "failed") {
			peer.connection.restartIce();
		}
	});
	peer.connection.addEventListener("datachannel", (e) => {
		if (e.channel.label === "messages") {
			peer.messageChannel = e.channel;
			peer.messageChannel.binaryType = "arraybuffer";
			setupMessageChannel(peer);
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

function setupMessageChannel(peer: Peer) {
	if (!peer.messageChannel) return;
	peer.messageChannel.addEventListener("open", () => {
		const identity = $identity.get();
		const session = $session.get();
		if (!identity || !session) return;
		const uploads = $uploads.get().length > 0;
		if (uploads) {
			return;
		}
		const msg = {
			type: MessageChannelEvents.ReadyToReceive,
			payload: {
				client_id: $identity.get()?.id,
			},
		};
		peer.messageChannel?.send(JSON.stringify(msg));
	});
	peer.messageChannel.addEventListener("close", () => {
		console.log("message channel closed");
	});
	peer.messageChannel.addEventListener("message", async (e) => {
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
				case MessageChannelEvents.ReadyToReceive:
					handleReadyToReceive(peer.id);
					break;
				case MessageChannelEvents.ShareFiles:
					handleShareFiles(peer.id, ShareFilesSchema.parse(data));
					break;
				case MessageChannelEvents.RequestFile:
					await handleRequestFile(peer.id, RequestFileSchema.parse(data));
					break;
				case MessageChannelEvents.CancelShare:
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
	if (!peer || !peer.messageChannel) return;
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
	sendMessage(peer.messageChannel, { type: "share-files", payload: { files } });
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
	peer.messageChannel?.close();
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
		p.messageChannel?.close();
		p.connection.close();
	});
	removePeers();
}

export function shareFiles(files: FileMetadata[]) {
	sendToPeers({ type: "share-files", payload: { files } });
}

export function sendCancelShare() {
	$peers.get().forEach((p) => {
		if (!p.messageChannel) {
			return;
		}
		sendMessage(p.messageChannel, { type: "cancel-share" });
	});
}

export function sendToPeers(msg: MessageChannelMessage) {
	const session = $session.get();
	if (!session) return;
	session.clients?.forEach((c) => {
		const peer = findPeer(c.id);
		if (peer && peer.messageChannel) {
			sendMessage(peer.messageChannel, msg);
		}
	});
}
