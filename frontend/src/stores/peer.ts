import { map } from "nanostores";
import type { FileMetadata } from "#/lib/file";
import type { Client } from "#/lib/schemas";
import type { ConnectionState } from "#/lib/webrtc";

export type PeerState = Client & {
	connectionState: ConnectionState;
	files?: FileMetadata[];
};

export const $peers = map<Record<string, PeerState>>({});

export function findPeer(id: string): PeerState | undefined {
	return $peers.get()[id];
}

export function addPeer(peer: PeerState) {
	$peers.setKey(peer.id, peer);
}

export function updatePeer(id: string, update: Partial<PeerState>) {
	const peers = $peers.get();
	const peer = peers[id];
	if (!peer) return;
	$peers.setKey(id, { ...peer, ...update });
}

export function removePeer(id: string) {
	const peers = { ...$peers.get() };
	delete peers[id];
	$peers.set(peers);
}

export function removePeers() {
	$peers.set({});
}
