import { atom, map } from "nanostores";
import { nanoid } from "nanoid";
import * as z from "zod/mini";
import { $peer, sendToChannel } from "#/lib/webrtc";

export type Chunk = {
	fileID: string;
	index: number;
	data: Uint8Array;
};

export const FileMetadataSchema = z.object({
	id: z.string(),
	name: z.string(),
	mime: z.string(),
	size: z.number(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

function createFileMetadata(file: File): FileMetadata {
	return {
		id: nanoid(),
		name: file.name,
		mime: file.type,
		size: file.size,
	};
}

type FileUpload = FileMetadata & { file: File };

export const $uploads = atom<FileUpload[]>([]);

export function shareFiles(files: File[]) {
	const uploads: FileUpload[] = files.map((file) => {
		const meta = createFileMetadata(file);
		return { ...meta, file: file };
	});
	$uploads.set(uploads);
	shareUploads(uploads);
}

export function shareUploads(uploads: FileUpload[]) {
	if (uploads.length < 1) return;
	const peer = $peer.get();
	if (!peer) return;
	const files = uploads.map((u) => ({
		id: u.id,
		name: u.name,
		mime: u.mime,
		size: u.size,
	}));
	sendToChannel(peer.dataChannel, {
		type: "share-files",
		payload: { files },
	});
}

export function sendCancelShare() {
	const peer = $peer.get();
	if (!peer) return;
	sendToChannel(peer.dataChannel, { type: "cancel-share" });
}

function sendRequestFile(id: string) {
	const peer = $peer.get();
	if (!peer) return;
	sendToChannel(peer.dataChannel, {
		type: "request-file",
		payload: { file_id: id },
	});
}

async function createDownloadStream(
	fileID: string,
	chunks: Download["chunks"],
): Promise<ReadableStream<Uint8Array>> {
	const chunkCount = Object.keys(chunks).length;
	let current = 0;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				if (current >= chunkCount) {
					controller.close();
					return;
				}

				const chunk = chunks[current];
				if (!chunk) {
					controller.error(
						new Error(`missing chunk ${current} for file ${fileID}`),
					);
					return;
				}

				controller.enqueue(chunk);
				current++;
			} catch (err) {
				controller.error(err);
			}
		},
	});
}

async function createBlob(file: Download): Promise<Blob> {
	const stream = await createDownloadStream(file.id, file.chunks);
	const response = new Response(stream);
	const blob = await response.blob();
	return blob;
}

export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 100);
}

type DownloadProgress = {
	downloading: boolean;
	totalCount: number;
	downloadedCount: number;
	progress: number;
};

export const $downloadProgress = map<DownloadProgress>({
	downloading: false,
	totalCount: 0,
	downloadedCount: 0,
	progress: 0,
});

function resetDownloadProgress() {
	$downloadProgress.set({
		downloading: false,
		totalCount: 0,
		downloadedCount: 0,
		progress: 0,
	});
}

type Download = FileMetadata & {
	chunks: { [key: number]: Uint8Array };
	downloadedBytes: number;
};

class DownloadManager {
	current: string | null = null;
	downloads: Map<string, Download> = new Map();

	setFiles(files: FileMetadata[]) {
		resetDownloadProgress();
		files.forEach((file) => {
			this.downloads.set(file.id, {
				...file,
				chunks: {},
				downloadedBytes: 0,
			});
		});
	}

	removeFile(id: string) {
		if (this.current === id) {
			this.current = null;
		}
		this.downloads.delete(id);
	}

	startDownload(id: string) {
		const download = this.downloads.get(id);
		if (!download) {
			console.error("start download: file not found");
			return;
		}
		$downloadProgress.setKey("totalCount", this.downloads.size);
		$downloadProgress.setKey("downloading", true);
		this.current = id;
		sendRequestFile(id);
	}

	async handleChunk(chunk: Chunk) {
		const file = this.downloads.get(chunk.fileID);
		if (!file) {
			return;
		}

		file.downloadedBytes += chunk.data.byteLength;
		file.chunks[chunk.index] = chunk.data;
		this.downloads.set(chunk.fileID, file);

		const progress = (file.downloadedBytes / file.size) * 100;
		if ($downloadProgress.get().progress !== progress) {
			$downloadProgress.setKey("progress", progress);
		}

		try {
			if (file.downloadedBytes === file.size) {
				$downloadProgress.setKey(
					"downloadedCount",
					$downloadProgress.get().downloadedCount + 1,
				);
				const blob = await createBlob(file);
				downloadBlob(blob, file.name);
				const next = findMapKey(
					this.downloads,
					(f) => f.downloadedBytes < f.size,
				);
				if (!next) {
					this.current = null;
					return;
				}
				this.startDownload(next);
			}
		} catch (err) {
			console.error(err);
		}
	}

	reset() {
		this.current = null;
		this.downloads.clear();
		resetDownloadProgress();
	}
}
export const downloadManager = new DownloadManager();

function findMapKey<K, V>(
	map: Map<K, V>,
	callback: (val: V) => boolean,
): K | undefined {
	for (const [key, val] of map.entries()) {
		if (callback(val)) {
			return key;
		}
	}
	return undefined;
}
