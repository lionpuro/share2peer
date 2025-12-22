import { useStore } from "@nanostores/react";
import { $uploads, sendCancelShare, shareFiles } from "#/lib/file";
import { stopTransfer } from "#/lib/webrtc";

export function useUpload() {
	const uploads = useStore($uploads);
	const cancelShare = () => {
		stopTransfer();
		sendCancelShare();
		$uploads.set([]);
	};
	const uploadFiles = (files: File[]) => shareFiles(files);
	return {
		uploads,
		uploadFiles,
		cancelShare,
	};
}
