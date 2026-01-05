import { useStore } from "@nanostores/react";
import {
	$transfers,
	deleteFileChannels,
	requestFile,
	resetTransfers,
} from "#/lib/webrtc/transfer";
import { filestore } from "#/lib/file";
import type { Peer } from "#/lib/webrtc";

export function useTransfer() {
	const transfers = useStore($transfers);
	const stopTransfers = () => {
		deleteFileChannels();
		resetTransfers();
		filestore.reset();
	};
	const startDownload = (peers: Peer[]) => {
		peers.forEach((peer) =>
			peer.files.forEach((f) => {
				if (!peer.signalChannel) return;
				requestFile(peer.id, peer.signalChannel, f);
			}),
		);
	};
	return {
		transfers,
		stopTransfers,
		startDownload,
	};
}
