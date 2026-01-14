import { useStore } from "@nanostores/react";
import {
	incoming,
	outgoing,
	$incoming,
	$outgoing,
	requestFile,
	stopTransfers,
} from "#/lib/webrtc/transfer";
import { filestore } from "#/lib/file";
import type { Peer } from "#/lib/webrtc";

export function useTransfer() {
	const incomingState = useStore($incoming);
	const outgoingState = useStore($outgoing);

	const stopIncoming = () => {
		stopTransfers(
			incoming,
			incoming.list().map((t) => t.id),
		);
		filestore.reset();
	};

	const stopOutgoing = () => {
		stopTransfers(
			outgoing,
			outgoing.list().map((t) => t.id),
		);
	};

	const startDownload = (peers: Peer[]) => {
		peers.forEach((p) =>
			p.files.forEach((f) => {
				requestFile(p, f.id);
			}),
		);
	};

	return {
		incoming: incomingState,
		outgoing: outgoingState,
		stopIncoming,
		stopOutgoing,
		findIncoming: (fileID: string) => incoming.findByFile(fileID).at(0),
		startDownload,
	};
}
