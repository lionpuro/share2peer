import { atom } from "nanostores";
import type { FileMetadata } from "#/lib/file";
import type { Client } from "#/lib/schemas";

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

export const $peers = atom<Peer[]>([]);

export function findPeer(id: string): Peer | undefined {
	return $peers.get().find((p) => p.id === id);
}

export function addPeer(peer: Peer) {
	const peers = $peers.get();
	if (peers.find((p) => p.id === peer.id)) {
		$peers.set([...peers.map((p) => (p.id === peer.id ? peer : p))]);
		return;
	}
	peers.push(peer);
	$peers.set([...peers]);
}

export function updatePeer(id: string, update: Partial<Peer>) {
	const peers = $peers.get();
	$peers.set([...peers.map((p) => (p.id !== id ? p : { ...p, ...update }))]);
}

export function removePeer(id: string) {
	$peers.set([...$peers.get().filter((p) => p.id !== id)]);
}

export function removePeers() {
	$peers.set([]);
}
