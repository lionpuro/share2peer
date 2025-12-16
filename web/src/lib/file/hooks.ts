import { useStore } from "@nanostores/react";
import {
	$downloadProgress,
	$uploads,
	sendCancelShare,
	shareFiles,
	stopTransfer,
	downloadManager,
} from "./file";
import { $peer } from "../webrtc";

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

export function useDownload() {
	const manager = downloadManager;
	const { downloading, downloadedCount, totalCount, progress } =
		useStore($downloadProgress);
	const peer = useStore($peer);
	const start = () => {
		if (!peer || peer.files.length === 0) {
			return;
		}
		manager.startDownload(peer.files[0].id);
	};
	return {
		status: (progress === 100 && downloadedCount === totalCount
			? "complete"
			: downloading
				? "downloading"
				: undefined) as "complete" | "downloading" | undefined,
		progress: progress,
		downloadedFiles: downloadedCount,
		totalFiles: totalCount,
		start: start,
	};
}
