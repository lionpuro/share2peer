import type { User, IncomingMessage } from "#/lib/schemas";
import type { SignalingServer } from "#/lib/server";
import { $identity, $room } from "#/stores/signaling";
import { createConnection, findConnection } from "./connection";

export async function createPeerConnection(
	server: SignalingServer,
	roomID: string,
	user: User,
) {
	const identity = $identity.get();
	if (!identity || findConnection(user.id)) {
		return;
	}

	try {
		const conn = createConnection(user, {
			onIceCandidate: (candidate) => {
				server.send({
					type: "ice-candidate",
					payload: {
						room_id: roomID,
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
				room_id: roomID,
				offer: offer,
			},
		});
	} catch (err) {
		console.error("create connection:", err);
	}
}

export async function handleOffer(
	server: SignalingServer,
	msg: Extract<IncomingMessage, { type: "offer" }>,
) {
	const user = $room.get()?.users?.find((u) => u.id === msg.payload.from);
	if (!user) return;

	const conn = createConnection(user, {
		onIceCandidate: (candidate) => {
			server.send({
				type: "ice-candidate",
				payload: {
					from: msg.payload.to,
					to: msg.payload.from,
					room_id: msg.payload.room_id,
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
			room_id: msg.payload.room_id,
			answer: answer,
		},
	});
}

export async function handleAnswer(
	msg: Extract<IncomingMessage, { type: "answer" }>,
) {
	const conn = findConnection(msg.payload.from);
	if (!conn) {
		console.error("handle answer: connection not found");
		return;
	}
	await conn.setRemoteDescription(msg.payload.answer);
}

export async function handleICECandidate(
	msg: Extract<IncomingMessage, { type: "ice-candidate" }>,
) {
	const conn = findConnection(msg.payload.from);
	if (!conn) {
		console.error("handle ice candidate: connection not found");
		return;
	}
	await conn.addIceCandidate(msg.payload.candidate);
}
