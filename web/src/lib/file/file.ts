import { atom } from "nanostores";
import { nanoid } from "nanoid";
import * as z from "zod/mini";
import { $peer, sendToPeer, type Peer } from "../webrtc";

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

function deleteUpload(id: string) {
	$uploads.set($uploads.get().filter((f) => f.id !== id));
}

export function shareFile(file: File) {
	const meta = createFileMetadata(file);
	const u: FileUpload = {
		...meta,
		file: file,
	};
	$uploads.set([u]);
	const peer = $peer.get();
	if (!peer || !peer.dataChannel) return;
	sendToPeer(peer, {
		type: "share-file",
		payload: meta,
	});
}

export function cancelShare(id: string) {
	deleteUpload(id);
	const peer = $peer.get();
	if (!peer || !peer.dataChannel) return;
	sendToPeer(peer, {
		type: "cancel-share",
		payload: { file_id: id },
	});
}

type DownloadState = {
	file: FileMetadata;
	chunks: ArrayBuffer[];
	bytes: number;
	result: Blob | null;
};

export const $downloadState = atom<DownloadState | null>(null);

export function startDownload(id: string) {
	const peer = $peer.get();
	if (!peer) return;
	const file = peer.files.find((f) => f.id === id);
	if (!file) {
		console.error("file with provided id not found");
		return;
	}
	$downloadState.set({
		file: file,
		chunks: [],
		bytes: 0,
		result: null,
	});
	requestFile(id);
}

export function handleCancelShare(id: string) {
	$downloadState.set(null);
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: peer.files.filter((f) => f.id !== id) });
}

function requestFile(id: string) {
	const peer = $peer.get();
	if (!peer) return;
	sendToPeer(peer, { type: "request-file", payload: { file_id: id } });
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

export async function sendFile(peer: Peer, file: File): Promise<void> {
	if (!peer.dataChannel || peer.dataChannel.readyState !== "open") {
		console.warn("data channel is not ready");
		return;
	}

	peer.dataChannel.bufferedAmountLowThreshold = chunkSize;

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
		await waitForBufferedAmountLow(peer.dataChannel);
		peer.dataChannel.send(chunk);
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
	if (!prev) {
		return;
	}
	const curr = {
		...prev,
		chunks: [...prev.chunks, chunk],
		bytes: prev.bytes + chunk.byteLength,
	};
	if (curr.bytes >= curr.file.size) {
		const blob = constructFile(curr.chunks, curr.file.mime);
		curr.result = blob;
	}
	$downloadState.set(curr);
}

export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function addDownloadableFile(meta: FileMetadata) {
	const peer = $peer.get();
	if (!peer) return;
	$peer.set({ ...peer, files: [...peer.files, meta] });
}

export function stopTransfer() {
	$uploadState.set(null);
	$downloadState.set(null);
}
