import { useStore } from "@nanostores/react";
import { $downloadProgress, downloadManager } from "#/lib/file";
import { $peer, sendCancelDownload } from "#/lib/webrtc";

export function useDownload() {
	const manager = downloadManager;
	const { downloading, downloadedCount, totalCount, progress } =
		useStore($downloadProgress);
	const peer = useStore($peer);
	const start = () => {
		if (!peer || peer.files.length === 0) {
			return;
		}
		manager.setFiles(peer.files);
		manager.startDownload(peer.files[0].id);
	};
	const cancel = () => {
		if (!peer || !peer.dataChannel || !downloading || !manager.current) return;
		sendCancelDownload(peer.dataChannel, manager.current);
		manager.reset();
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
		cancel: cancel,
	};
}
