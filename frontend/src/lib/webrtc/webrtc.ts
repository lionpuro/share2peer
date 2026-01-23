import type {
	AnswerMessage,
	Client,
	ICECandidateMessage,
	OfferMessage,
} from "#/lib/schemas";
import { $identity, type SignalingServer } from "#/lib/server";
import { $session } from "#/lib/session";
import { $uploads, getUpload } from "#/lib/file";
import {
	addConnection,
	addPeer,
	createPeer,
	findPeer,
	getConnection,
	PeerConnection,
	removePeer,
	removePeers,
	updatePeer,
} from "./peer";
import {
	incoming,
	outgoing,
	handleStartTransfer,
	stopTransfers,
} from "./transfer";

export async function createPeerConnection(
	server: SignalingServer,
	sessionID: string,
	client: Client,
) {
	const identity = $identity.get();
	if (!identity || findPeer(client.id)) {
		return;
	}

	const peer = createPeer(client);
	addPeer(peer);

	try {
		const conn = new PeerConnection(peer.id, {
			onIceCandidate: (candidate) => {
				server.send({
					type: "ice-candidate",
					payload: {
						session_id: sessionID,
						candidate: candidate.toJSON(),
						from: identity.id,
						to: peer.id,
					},
				});
			},
		});
		attachMessageListeners(conn);
		addConnection(conn);
		conn.createMessageChannel();
		const offer = await conn.createOffer();

		server.send({
			type: "offer",
			payload: {
				from: identity.id,
				to: peer.id,
				session_id: sessionID,
				offer: offer,
			},
		});
	} catch (err) {
		console.error("initiate connection:", err);
	}
}

export async function handleOffer(server: SignalingServer, msg: OfferMessage) {
	const client = $session
		.get()
		?.clients?.find((c) => c.id === msg.payload.from);
	if (!client) return;

	const peer = createPeer(client);
	addPeer(peer);

	const conn = new PeerConnection(peer.id, {
		onIceCandidate: (candidate) => {
			server.send({
				type: "ice-candidate",
				payload: {
					from: msg.payload.to,
					to: peer.id,
					session_id: msg.payload.session_id,
					candidate: candidate.toJSON(),
				},
			});
		},
	});
	attachMessageListeners(conn);
	addConnection(conn);
	const answer = await conn.createAnswer(msg.payload.offer);

	server.send({
		type: "answer",
		payload: {
			from: msg.payload.to,
			to: msg.payload.from,
			session_id: msg.payload.session_id,
			answer: answer,
		},
	});
}

export async function handleAnswer(msg: AnswerMessage) {
	const conn = getConnection(msg.payload.from);
	if (!conn) {
		console.error("handle answer: connection not found");
		return;
	}
	await conn.handleAnswer(msg.payload.answer);
}

export async function handleICECandidate(msg: ICECandidateMessage) {
	const conn = getConnection(msg.payload.from);
	if (!conn) {
		console.error("handle ice candidate: connection not found");
		return;
	}
	await conn.addIceCandidate(msg.payload.candidate);
}

function attachMessageListeners(conn: PeerConnection) {
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

export function closePeerConnection(peerID: string) {
	stopTransfers(
		incoming,
		incoming.findByPeer(peerID).map((t) => t.id),
	);
	stopTransfers(
		outgoing,
		outgoing.findByPeer(peerID).map((t) => t.id),
	);
	removePeer(peerID);
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
	removePeers();
}
