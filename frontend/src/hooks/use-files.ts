import { useStore } from "@nanostores/react";
import { broadcast, findConnection, startDownload } from "#/lib/webrtc";
import { $peers } from "#/stores/peer";
import { $uploads, setUploads, type FileUpload } from "#/stores/file";

export function useFiles() {
	const peers = useStore($peers);
	const peerFiles = Object.values(peers).flatMap((p) => {
		return p?.files?.map((f) => ({ ...f, uploader: p.id })) || [];
	});
	const uploads = useStore($uploads);
	const uploadedFiles = Object.values(uploads);

	const downloadFile = async (id: string) => {
		const file = peerFiles.find((f) => f.id === id);
		if (!file) return;
		const conn = findConnection(file.uploader);
		if (conn) {
			await startDownload(file, conn);
		}
	};

	const addFiles = (files: FileUpload[]) => {
		if (files.length > 0) {
			const value = [...uploads, ...files];
			setUploads(value);
			broadcast({
				type: "share-files",
				payload: {
					files: value.map((u) => ({
						id: u.id,
						name: u.name,
						mime: u.mime,
						size: u.size,
					})),
				},
			});
		}
	};

	const removeFile = (id: string) => {
		const uploads = $uploads.get().filter((u) => u.id !== id);
		broadcast({ type: "share-files", payload: { files: uploads } });
		setUploads(uploads);
	};

	return {
		uploadedFiles,
		peerFiles,
		addFiles,
		removeFile,
		downloadFile,
	};
}
