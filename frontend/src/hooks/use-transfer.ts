import { useStore } from "@nanostores/react";
import {
	incoming,
	outgoing,
	$incoming,
	$outgoing,
	requestFile,
	stopTransfers,
} from "#/lib/webrtc/transfer";
import { type PeerState, connections } from "#/lib/webrtc";

export function useTransfer() {
	const incomingState = useStore($incoming);
	const outgoingState = useStore($outgoing);

	const stopIncoming = () => {
		stopTransfers(
			incoming,
			incoming.list().map((t) => t.id),
		);
	};

	const stopOutgoing = () => {
		stopTransfers(
			outgoing,
			outgoing.list().map((t) => t.id),
		);
	};

	const startDownload = async (peers: PeerState[]) => {
		const files = peers.flatMap((p) => {
			return p.files.map((f) => ({ ...f, peerID: p.id }));
		});

		for (const file of files) {
			const conn = connections.get(file.peerID);
			if (conn) {
				await requestFile(conn, file);
			}
		}
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
