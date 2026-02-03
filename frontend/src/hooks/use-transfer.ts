import { useStore } from "@nanostores/react";
import { showSaveFilePicker } from "native-file-system-adapter";
import {
	incoming,
	outgoing,
	$incoming,
	$outgoing,
	requestFile,
	stopTransfers,
} from "#/lib/webrtc/transfer";
import { filestore } from "#/lib/file";
import { type PeerState, connections } from "#/lib/webrtc";

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

	const startDownload = async (peers: PeerState[]) => {
		const files = peers.flatMap((p) => {
			return p.files.map((f) => ({ ...f, peerID: p.id }));
		});

		for (const file of files) {
			const handle = await showSaveFilePicker({
				_preferPolyfill: false,
				suggestedName: file.name,
			});
			await filestore.addFile(file, handle);
		}
		files.forEach((file) => {
			const conn = connections.get(file.peerID);
			if (!conn) {
				console.error("peer connection not open");
				return;
			}
			requestFile(conn, file);
		});
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
