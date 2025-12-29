import { useStore } from "@nanostores/react";
import { $uploads, setUploads, deleteUploads } from "#/lib/file";
import { sendCancelShare, shareUploads } from "#/lib/webrtc";
import { deleteFileChannels, resetTransfers } from "#/lib/webrtc/transfer";

export function useUpload() {
	const uploads = useStore($uploads);
	const cancelUploads = () => {
		deleteFileChannels();
		resetTransfers();
		sendCancelShare();
		deleteUploads();
	};
	return {
		uploads,
		setUploads,
		shareUploads,
		cancelUploads,
	};
}
