import { useStore } from "@nanostores/react";
import {
	$downloadState,
	$uploads,
	sendCancelShare,
	shareFiles,
	startDownload,
	stopTransfer,
} from "./file";

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
	const { currentFile, queue, results } = useStore($downloadState);
	return {
		currentFile: currentFile,
		queue: queue,
		results: results,
		status: currentFile
			? "receiving"
			: queue.length === 0 && results.length > 0
				? "complete"
				: "initial",
		progress: currentFile
			? Math.round((currentFile.bytes / currentFile.metadata.size) * 100)
			: 0,
		start: startDownload,
	};
}
