import { atom, map } from "nanostores";
import { nanoid } from "nanoid";
import * as z from "zod/mini";
import { $peer, sendToChannel } from "../webrtc";

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

type DownloadState = {
	currentFile: {
		metadata: FileMetadata;
		chunks: ArrayBuffer[];
		bytes: number;
	} | null;
	queue: FileMetadata[];
	results: {
		metadata: FileMetadata;
		blob: Blob;
	}[];
};

export const $downloadState = map<DownloadState>({
	currentFile: null,
	queue: [],
	results: [],
});

function stopDownloads() {
	$downloadState.set({ currentFile: null, queue: [], results: [] });
}

export function setDownloads(files: FileMetadata[]) {
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: files });
}

export function startDownload() {
	const peer = $peer.get();
	if (!peer) return;
	if (peer.files.length < 1) return;
	const file = peer.files[0];
	$downloadState.set({
		currentFile: { metadata: file, chunks: [], bytes: 0 },
		queue: peer.files,
		results: [],
	});
	requestFile(file.id);
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
	bytes: number;
};

export const $uploadState = atom<UploadState | null>(null);

function waitForBufferedAmountLow(chan: RTCDataChannel): Promise<void> {
	return new Promise((resolve) => {
		const threshold = chunkSize * 8;
		if (chan.bufferedAmount < threshold) {
			return resolve();
		}
		const handler = () => {
			if (chan.bufferedAmount < threshold) {
				chan.removeEventListener("bufferedamountlow", handler);
				resolve();
			}
		};
		chan.addEventListener("bufferedamountlow", handler);
		// fallback resolve after a timeout
		setTimeout(resolve, 2000);
	});
}

export async function sendFile(
	chan: RTCDataChannel | undefined,
	file: File,
): Promise<void> {
	if (!chan || chan.readyState !== "open") {
		console.warn("data channel is not ready");
		return;
	}

	chan.bufferedAmountLowThreshold = chunkSize;

	const chunks = sliceFile(file);
	const totalChunks = chunks.length;

	$uploadState.set({ file: file, bytes: 0 });

	let bytesSent = 0;
	for (let i = 0; i < totalChunks; i++) {
		const uploadState = $uploadState.get();
		if (!uploadState) {
			return;
		}
		const chunk = await chunks[i].arrayBuffer();
		await waitForBufferedAmountLow(chan);
		chan.send(chunk);
		bytesSent += chunk.byteLength;
		$uploadState.set({ ...uploadState, bytes: bytesSent });
	}
}

const chunkSize = 16 * 1024; // 16KB

function sliceFile(file: File): Blob[] {
	const chunks: Blob[] = [];
	let offset = 0;
	while (offset < file.size) {
		const slice = file.slice(offset, offset + chunkSize);
		chunks.push(slice);
		offset += chunkSize;
	}
	return chunks;
}

export function constructFile(chunks: ArrayBuffer[], type: string): Blob {
	return new Blob(chunks, { type });
}

export function saveChunk(chunk: ArrayBuffer) {
	const prev = $downloadState.get();
	if (!prev.currentFile) {
		console.warn("save chunk: no current file");
		return;
	}
	const currentFile = {
		...prev.currentFile,
		chunks: [...prev.currentFile.chunks, chunk],
		bytes: prev.currentFile.bytes + chunk.byteLength,
	};

	if (currentFile.bytes >= currentFile.metadata.size) {
		const blob = constructFile(currentFile.chunks, currentFile.metadata.mime);
		$downloadState.set({
			currentFile: null,
			queue: prev.queue.filter((f) => f.id !== currentFile.metadata.id),
			results: [
				...prev.results,
				{ metadata: currentFile.metadata, blob: blob },
			],
		});

		const state = $downloadState.get();

		if (state.queue.length < 1) {
			state.results.forEach((f) => downloadBlob(f.blob, f.metadata.name));
			return;
		}

		const next = state.queue[0];
		$downloadState.set({
			...state,
			currentFile: { metadata: next, chunks: [], bytes: 0 },
		});
		requestFile(next.id);
		return;
	}
	$downloadState.set({ ...prev, currentFile: currentFile });
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
	stopDownloads();
}
