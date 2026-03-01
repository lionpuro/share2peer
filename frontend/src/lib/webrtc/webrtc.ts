import type { Client, IncomingMessageBody } from "#/lib/schemas";
import type { SignalingServer } from "#/lib/server";
import { $identity, $room } from "#/stores/signaling";
import { createConnection, findConnection } from "./connection";

export async function createPeerConnection(
	server: SignalingServer,
	roomID: string,
	client: Client,
) {
	const identity = $identity.get();
	if (!identity || findConnection(client.id)) {
		return;
	}

	try {
		const conn = createConnection(client, {
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
	msg: Extract<IncomingMessageBody, { type: "offer" }>,
) {
	const client = $room.get()?.clients?.find((c) => c.id === msg.payload.from);
	if (!client) return;

	const conn = createConnection(client, {
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
	msg: Extract<IncomingMessageBody, { type: "answer" }>,
) {
	const conn = findConnection(msg.payload.from);
	if (!conn) {
		console.error("handle answer: connection not found");
		return;
	}
	await conn.setRemoteDescription(msg.payload.answer);
}

export async function handleICECandidate(
	msg: Extract<IncomingMessageBody, { type: "ice-candidate" }>,
) {
	const conn = findConnection(msg.payload.from);
	if (!conn) {
		console.error("handle ice candidate: connection not found");
		return;
	}
	await conn.addIceCandidate(msg.payload.candidate);
}
