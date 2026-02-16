import { nanoid } from "nanoid";
import { ChunkReader, getUpload, type FileMetadata } from "#/lib/file";
import { sendPacket, setupDataChannel } from "./datachannel";
import { decodeChunk, encodeChunk } from "./protocol";
import { PeerConnection } from "./peer";
import { createDownloadStream, type DownloadStream } from "#/lib/file/download";
import {
	addTransfer,
	findTransfer,
	removeTransfer,
	updateTransfer,
	type Transfer,
} from "#/stores/transfer";

export function stopTransfer(t: Transfer) {
	t.channel?.close();
	removeTransfer(t.id);
}

export async function startDownload(file: FileMetadata, conn: PeerConnection) {
	let stream: DownloadStream | undefined = await createDownloadStream(file);
	const chan = await conn.createFileChannel(file.id);

	const id = nanoid();
	addTransfer({
		type: "download",
		id: id,
		fileID: file.id,
		peer: conn.id,
		size: file.size,
		progress: 0,
		status: "waiting",
		channel: chan,
	});

	let transferred = 0;

	chan.addEventListener("message", (e) => {
		const data: unknown = e.data;
		if (!(data instanceof ArrayBuffer)) {
			console.error("filechannel: unrecognized message type");
			return;
		}
		try {
			const chunk = decodeChunk(data);
			stream?.enqueue(chunk.data);

			transferred += chunk.data.byteLength;
			updateTransfer(id, (prev) => ({
				...prev,
				status: prev.status === "waiting" ? "active" : prev.status,
				progress: Math.round((transferred / file.size) * 100),
			}));

			if (transferred === file.size) {
				stream?.close();
				stream = undefined;
			}
		} catch (err) {
			console.error("transfer message:", err);
		}
	});

	chan.addEventListener("close", () => {
		stream?.abort();
		stream = undefined;
		const transfer = findTransfer(id);
		if (transfer && transfer.status !== "complete") {
			removeTransfer(id);
		}
	});

	chan.addEventListener("error", (e) => {
		console.error("transfer error:", e.error);
		chan.close();
	});

	stream
		.start()
		.then(() => {
			updateTransfer(id, { status: "complete" });
			chan.close();
		})
		.catch((err) => {
			console.error("file stream:", err);
			updateTransfer(id, { status: "canceled" });
			chan.close();
		});
}

export function startUpload(
	chan: RTCDataChannel,
	peerID: string,
	fileID: string,
) {
	setupDataChannel(chan);
	const file = getUpload(fileID);
	if (!file) {
		chan.close();
		return;
	}
	const id = nanoid();
	chan.addEventListener("close", () => {
		const transfer = findTransfer(id);
		if (transfer && transfer.status !== "complete") {
			removeTransfer(id);
		}
	});
	chan.addEventListener("error", (e) => {
		console.error("transfer error:", e.error);
		chan.close();
	});
	addTransfer({
		type: "upload",
		id: id,
		fileID: fileID,
		peer: peerID,
		size: file.size,
		progress: 0,
		status: "waiting",
		channel: chan,
	});
	sendFile(id, file.file).catch((err) => {
		console.error(err);
		removeTransfer(id);
	});
}

async function sendFile(transferID: string, file: File) {
	const chan = findTransfer(transferID)?.channel;
	if (!chan) {
		updateTransfer(transferID, { status: "canceled" });
		return;
	}

	updateTransfer(transferID, { status: "active" });

	let transferred = 0;

	const reader = new ChunkReader();
	await reader.read(file, async (chunk, index) => {
		if (!chan || chan.readyState !== "open") {
			reader.stop();
			return;
		}
		const packet = encodeChunk({
			fileID: transferID,
			index: index,
			data: chunk,
		});
		await sendPacket(chan, packet);
		transferred += chunk.byteLength;
		updateTransfer(transferID, {
			...(transferred === file.size ? { status: "complete" } : {}),
			progress: Math.round((transferred / file.size) * 100),
		});
	});
}
