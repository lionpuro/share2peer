import { atom } from "nanostores";
import type { FileMetadata } from "#/lib/file";
import type { DataChannelMessageQueue } from "./datachannel";

export const $peer = atom<Peer | null>(null);

export type Peer = {
	id: string;
	connection: RTCPeerConnection;
	dataChannel?: RTCDataChannel;
	messageQueue?: DataChannelMessageQueue;
	files: FileMetadata[];
};

export function createPeer(id: string): Peer {
	const peer: Peer = {
		id: id,
		connection: new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		}),
		files: [],
	};
	return peer;
}
