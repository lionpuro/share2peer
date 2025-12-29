import { useStore } from "@nanostores/react";
import {
	$transfers,
	deleteFileChannels,
	resetTransfers,
	startDownload,
} from "#/lib/webrtc/transfer";
import { filestore } from "#/lib/file";

export function useTransfer() {
	const transfers = useStore($transfers);
	const stopTransfers = () => {
		deleteFileChannels();
		resetTransfers();
		filestore.reset();
	};
	return {
		transfers,
		stopTransfers,
		startDownload,
	};
}
