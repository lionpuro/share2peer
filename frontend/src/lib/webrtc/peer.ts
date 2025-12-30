import { atom } from "nanostores";
import type { FileMetadata } from "#/lib/file";
import type { Client } from "#/lib/client";

export const $peer = atom<Peer | null>(null);

export type Peer = Client & {
	connection: RTCPeerConnection;
	signalChannel?: RTCDataChannel;
	files: FileMetadata[];
};

export function createPeer(client: Client): Peer {
	const peer: Peer = {
		...client,
		connection: new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		}),
		files: [],
	};
	return peer;
}
