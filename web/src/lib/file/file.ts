import { atom, map } from "nanostores";
import { nanoid } from "nanoid";
import * as z from "zod/mini";
import { $peer, DataChannelMessageQueue, sendToChannel } from "../webrtc";
import { decodeChunk, encodeChunk } from "./encoding";
import { CHUNK_DATA_SIZE, MESSAGE_SIZE } from "../constants";

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

export type Chunk = {
	fileID: string;
	data: Uint8Array;
};

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

function requestFile(id: string) {
	const peer = $peer.get();
	if (!peer) return;
	sendToChannel(peer.dataChannel, {
		type: "request-file",
		payload: { file_id: id },
	});
}

type UploadState = {
	file: File;
	progress: number;
};

export const $uploadState = atom<UploadState | null>(null);

export function sendFile(
	chan: RTCDataChannel | undefined,
	file: File,
	meta: FileMetadata,
) {
	if (!chan || chan.readyState !== "open") {
		console.warn("data channel is not ready");
		return;
	}

	chan.bufferedAmountLowThreshold = MESSAGE_SIZE;

	let sentBytes = 0;
	const queue = new DataChannelMessageQueue(chan, (msg) => {
		if (!(msg instanceof ArrayBuffer)) {
			return;
		}
		try {
			const chunk = decodeChunk(new Uint8Array(msg));
			sentBytes += chunk.data.byteLength;
			const val = $uploadState.get();
			if (!val) return;
			$uploadState.set({
				...val,
				progress: (sentBytes / file.size) * 100,
			});
		} catch (err) {
			console.error(err);
		}
	});

	const reader = new FileReader();
	let offset = 0;
	reader.addEventListener("load", (e) => {
		const result = e.target?.result;
		if (!result || !(result instanceof ArrayBuffer)) {
			return;
		}

		const chunk: Chunk = {
			fileID: meta.id,
			data: new Uint8Array(result),
		};
		const c = encodeChunk(chunk);
		const buf = c.buffer.slice(c.byteOffset, c.byteLength + c.byteOffset);
		queue.enqueue(buf);

		offset += result.byteLength;
		if (offset < file.size) {
			readSlice(offset);
		}
	});
	const readSlice = (o: number) => {
		const slice = file.slice(offset, o + CHUNK_DATA_SIZE);
		reader.readAsArrayBuffer(slice);
	};
	readSlice(0);
}

async function createDownloadStream(
	fileID: string,
	chunks: Uint8Array[],
): Promise<ReadableStream<Uint8Array>> {
	let currentChunk = 0;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				if (currentChunk >= chunks.length) {
					controller.close();
					return;
				}

				const chunk = chunks[currentChunk];
				if (!chunk) {
					controller.error(
						new Error(`missing chunk ${currentChunk} for file ${fileID}`),
					);
					return;
				}

				const data = new Uint8Array(chunk);
				controller.enqueue(data);
				currentChunk++;
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

export function stopTransfer() {
	$uploadState.set(null);
	downloadManager.reset();
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
	chunks: Uint8Array[];
	downloadedBytes: number;
};

class DownloadManager {
	current: string | null = null;
	downloads: Map<string, Download> = new Map();

	setFiles(files: FileMetadata[]) {
		files.forEach((file) => {
			this.downloads.set(file.id, {
				...file,
				chunks: [],
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
		requestFile(id);
	}

	async handleChunk(chunk: Chunk) {
		const file = this.downloads.get(chunk.fileID);
		if (!file) {
			return;
		}

		file.downloadedBytes += chunk.data.byteLength;
		file.chunks.push(chunk.data);
		this.downloads.set(chunk.fileID, file);

		const progress = (file.downloadedBytes / file.size) * 100;
		if ($downloadProgress.get().progress !== progress) {
			$downloadProgress.setKey("progress", progress);
		}

		try {
			if (file.downloadedBytes >= file.size) {
				$downloadProgress.setKey(
					"downloadedCount",
					$downloadProgress.get().downloadedCount + 1,
				);
				await createBlob(file).then((blob) => downloadBlob(blob, file.name));
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
