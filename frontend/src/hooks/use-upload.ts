import { useStore } from "@nanostores/react";
import {
	$uploads,
	sendCancelShare,
	shareFiles,
	stopTransfer,
} from "#/lib/file";

export function useUpload() {
	const uploads = useStore($uploads);
	const removeUploads = () => {
		stopTransfer();
		sendCancelShare();
		$uploads.set([]);
	};
	const uploadFiles = (files: File[]) => shareFiles(files);
	return {
		uploads,
		uploadFiles,
		removeUploads,
	};
}
