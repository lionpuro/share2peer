import { useStore } from "@nanostores/react";
import {
	$incoming,
	$outgoing,
	$outgoingState,
	findTransfersByFile,
	listTransfers,
	requestFile,
	stopTransfers,
} from "#/lib/webrtc/transfer";
import { filestore } from "#/lib/file";
import type { Peer } from "#/lib/webrtc";

export function useTransfer() {
	const incoming = useStore($incoming);
	const outgoing = useStore($outgoing);
	const outgoingState = useStore($outgoingState);

	const stopIncoming = () => {
		stopTransfers(
			$incoming,
			listTransfers($incoming).map((t) => t.id),
		);
		filestore.reset();
	};

	const stopOutgoing = () => {
		stopTransfers(
			$outgoing,
			listTransfers($incoming).map((t) => t.id),
		);
	};

	const startDownload = (peers: Peer[]) => {
		peers.forEach((p) =>
			p.files.forEach((f) => {
				requestFile(p, f.id);
			}),
		);
	};

	const findIncoming = (fileID: string) => {
		return findTransfersByFile($incoming, fileID)[0];
	};

	return {
		incoming: Object.values(incoming.transfers),
		outgoing: Object.values(outgoing.transfers),
		stopIncoming,
		stopOutgoing,
		findIncoming,
		outgoingState,
		startDownload,
	};
}
