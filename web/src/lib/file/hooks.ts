import { useStore } from "@nanostores/react";
import {
	$downloadState,
	$uploads,
	cancelShare,
	shareFile,
	startDownload,
	type FileMetadata,
} from "./file";

export function useUpload() {
	const uploads = useStore($uploads);
	const removeUploads = () => uploads.forEach((u) => cancelShare(u.id));
	const uploadFile = (file: File) => shareFile(file);
	return {
		uploads,
		uploadFile,
		removeUploads,
	};
}

type UseDownloadValue = {
	metadata: FileMetadata | null;
	status: null | "receiving" | "complete";
	progress: number;
	result: Blob | null;
	start: typeof startDownload;
};

export function useDownload(): UseDownloadValue {
	const downloadState = useStore($downloadState);
	if (!downloadState) {
		return {
			metadata: null,
			status: null,
			progress: 0,
			result: null,
			start: startDownload,
		};
	}
	return {
		metadata: downloadState.file,
		status: downloadState.result ? "complete" : "receiving",
		progress: Math.round((downloadState.bytes / downloadState.file.size) * 100),
		result: downloadState.result,
		start: startDownload,
	};
}
