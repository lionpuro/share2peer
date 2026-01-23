import type {
	AnswerMessage,
	Client,
	ICECandidateMessage,
	OfferMessage,
} from "#/lib/schemas";
import { $identity, type SignalingServer } from "#/lib/server";
import { $session } from "#/lib/session";
import { connections } from "./peer";

export async function createPeerConnection(
	server: SignalingServer,
	sessionID: string,
	client: Client,
) {
	const identity = $identity.get();
	if (!identity || connections.get(client.id)) {
		return;
	}

	try {
		const conn = connections.create(client, {
			onIceCandidate: (candidate) => {
				server.send({
					type: "ice-candidate",
					payload: {
						session_id: sessionID,
						candidate: candidate.toJSON(),
						from: identity.id,
						to: conn.id,
					},
				});
			},
		});
		conn.createMessageChannel();
		const offer = await conn.createOffer();

		server.send({
			type: "offer",
			payload: {
				from: identity.id,
				to: conn.id,
				session_id: sessionID,
				offer: offer,
			},
		});
	} catch (err) {
		console.error("create connection:", err);
	}
}

export async function handleOffer(server: SignalingServer, msg: OfferMessage) {
	const client = $session
		.get()
		?.clients?.find((c) => c.id === msg.payload.from);
	if (!client) return;

	const conn = connections.create(client, {
		onIceCandidate: (candidate) => {
			server.send({
				type: "ice-candidate",
				payload: {
					from: msg.payload.to,
					to: msg.payload.from,
					session_id: msg.payload.session_id,
					candidate: candidate.toJSON(),
				},
			});
		},
	});
	await conn.setRemoteDescription(msg.payload.offer);
	const answer = await conn.createAnswer();

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
	const conn = connections.get(msg.payload.from);
	if (!conn) {
		console.error("handle answer: connection not found");
		return;
	}
	await conn.setRemoteDescription(msg.payload.answer);
}

export async function handleICECandidate(msg: ICECandidateMessage) {
	const conn = connections.get(msg.payload.from);
	if (!conn) {
		console.error("handle ice candidate: connection not found");
		return;
	}
	await conn.addIceCandidate(msg.payload.candidate);
}
