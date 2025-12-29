import { map } from "nanostores";
import {
	ChunkReader,
	downloadBlob,
	filestore,
	type FileMetadata,
} from "#/lib/file";
import { sendSignal, type DataChannelType } from "./datachannel";
import { decodeChunk, encodeChunk, PACKET_SIZE } from "./protocol";
import { $peer } from "./peer";

type FileChannel = {
	channel: RTCDataChannel;
	peer: string;
};

export const filechannels = new Map<string, FileChannel>();

export function getFileChannel(id: string): FileChannel | undefined {
	return filechannels.get(id);
}

export function addFileChannel(id: string, fc: FileChannel) {
	filechannels.set(id, fc);
}

export function deleteFileChannel(id: string) {
	const chan = filechannels.get(id);
	if (
		chan?.channel.readyState !== "closed" &&
		chan?.channel.readyState !== "closing"
	) {
		chan?.channel.close();
	}
	filechannels.delete(id);
}

export function deleteFileChannels() {
	filechannels.forEach((ch) => ch.channel.close());
	filechannels.clear();
}

type TransferStatus =
	| "waiting"
	| "sending"
	| "receiving"
	| "complete"
	| "failed";

export type Transfer = {
	id: string;
	file: FileMetadata;
	status: TransferStatus;
	transferredBytes: number;
};

export type TransferState = { [id: string]: Transfer };

export const $transfers = map<TransferState>({});

export function getTransfer(id: string): Transfer | undefined {
	return $transfers.get()[id];
}

export function addTransfer(t: Transfer) {
	$transfers.setKey(t.id, t);
}

export function updateTransfer(id: string, value: Partial<Transfer>) {
	const prev = $transfers.get()[id];
	if (!prev) return;
	$transfers.setKey(id, { ...prev, ...value });
}

export function deleteTransfer(id: string) {
	const transfers = $transfers.get();
	if (id in transfers) {
		delete transfers[id];
		$transfers.set({ ...transfers });
	}
}

export function resetTransfers() {
	$transfers.set({});
}

export async function transferFile(
	chan: RTCDataChannel,
	file: File,
	meta: FileMetadata,
) {
	addTransfer({
		id: meta.id,
		file: meta,
		status: "sending",
		transferredBytes: 0,
	});
	const reader = new ChunkReader();
	await reader.read(file, async (chunk, index) => {
		if (chan.readyState !== "open") {
			reader.stop();
			return;
		}
		const packet = encodeChunk({
			fileID: meta.id,
			index: index,
			data: chunk,
		});
		await sendPacket(chan, packet);
		const transfer = getTransfer(meta.id);
		if (!transfer) return;
		const bytes = transfer.transferredBytes + chunk.byteLength;
		updateTransfer(meta.id, {
			status: bytes === meta.size ? "complete" : "sending",
			transferredBytes: bytes,
		});
	});
}

export function startDownload() {
	const peer = $peer.get();
	if (!peer || !peer.signalChannel) return;
	peer.files.forEach((f) => requestFile(peer.signalChannel!, f));
}

export function requestFile(sigchan: RTCDataChannel, file: FileMetadata) {
	addTransfer({
		id: file.id,
		file: file,
		status: "waiting",
		transferredBytes: 0,
	});
	filestore.addFile(file);
	sendSignal(sigchan, {
		type: "request-file",
		payload: { file_id: file.id },
	});
}

// create a channel for sending
export function createSendChannel(
	conn: RTCPeerConnection,
	id: string,
): Promise<RTCDataChannel> {
	return new Promise((resolve, reject) => {
		const chan = conn.createDataChannel(`file-${id}` satisfies DataChannelType);
		chan.binaryType = "arraybuffer";
		chan.bufferedAmountLowThreshold = PACKET_SIZE;
		const timeout = setTimeout(() => {
			reject("create channel timed out");
		}, 5 * 1000);
		chan.addEventListener("open", () => {
			clearTimeout(timeout);
			resolve(chan);
		});
		chan.addEventListener("close", () => {
			deleteFileChannel(id);
			deleteTransfer(id);
		});
	});
}

// set up a channel for receiving
export function setupReceiveChannel(
	chan: RTCDataChannel,
	id: string,
): RTCDataChannel {
	const tr = getTransfer(id);
	if (!tr || !filestore.getFile(id)) {
		chan.close();
		throw new Error("unrecognized file channel");
	}
	chan.binaryType = "arraybuffer";
	chan.addEventListener("message", async (e) => {
		if (!(e.data instanceof ArrayBuffer)) {
			console.error("filechannel: unrecognized message type");
			return;
		}
		try {
			const chunk = decodeChunk(e.data as ArrayBuffer);
			filestore.addChunk(chunk);
			const transfer = getTransfer(id);
			if (transfer) {
				const bytes = transfer.transferredBytes + chunk.data.byteLength;
				updateTransfer(id, { status: "receiving", transferredBytes: bytes });
			}
			const file = filestore.getFile(chunk.fileID);
			if (!file) return;
			if (file.currentSize === file.metadata.size) {
				const stream = await filestore.getResult(chunk.fileID);
				const blob = await new Response(stream).blob();
				downloadBlob(blob, file.metadata.name);
				updateTransfer(id, { status: "complete" });
				if (
					Object.values($transfers.get()).every((t) => t.status === "complete")
				) {
					deleteFileChannels();
				}
			}
		} catch (err) {
			console.error("filechannel:", err);
		}
	});
	chan.addEventListener("close", () => {
		deleteFileChannel(id);
		deleteTransfer(id);
		filestore.removeFile(id);
	});
	return chan;
}

export async function sendPacket(chan: RTCDataChannel, packet: ArrayBuffer) {
	if (chan.readyState !== "open") {
		throw new Error("channel is not open");
	}
	await waitForFreeBuffer(chan);
	chan.send(packet);
}

function waitForFreeBuffer(chan: RTCDataChannel): Promise<void> {
	return new Promise((resolve) => {
		const bufferedAmountMax = PACKET_SIZE * 8;
		if (chan.bufferedAmount < bufferedAmountMax) {
			resolve();
			return;
		}

		const timeout = setTimeout(resolve, 2000);

		const handler = () => {
			if (chan.bufferedAmount < bufferedAmountMax) {
				chan.removeEventListener("bufferedamountlow", handler);
				clearTimeout(timeout);
				resolve();
			}
		};
		chan.addEventListener("bufferedamountlow", handler);
	});
}
