import { map } from "nanostores";
import {
	ChunkReader,
	downloadBlob,
	filestore,
	type FileMetadata,
} from "#/lib/file";
import { sendSignal, type DataChannelType } from "./datachannel";
import { decodeChunk, encodeChunk, PACKET_SIZE } from "./protocol";

type FileChannel = {
	channel: RTCDataChannel;
	peer: string;
};

export const filechannels: Partial<Record<string, Map<string, FileChannel>>> =
	{};

export function getFileChannel(
	peer: string,
	id: string,
): FileChannel | undefined {
	return filechannels[peer]?.get(id);
}

export function addFileChannel(peer: string, id: string, fc: FileChannel) {
	if (!filechannels[peer]) {
		filechannels[peer] = new Map();
	}
	filechannels[peer].set(id, fc);
}

export function deleteFileChannel(peer: string, id: string) {
	const chan = filechannels[peer]?.get(id);
	if (
		chan?.channel.readyState !== "closed" &&
		chan?.channel.readyState !== "closing"
	) {
		chan?.channel.close();
	}
	filechannels[peer]?.delete(id);
	if (filechannels[peer]?.size === 0) {
		delete filechannels[peer];
	}
}

export function deleteFileChannels() {
	Object.entries(filechannels).forEach(([peer, value]) => {
		value?.forEach((ch) => ch.channel.close());
		delete filechannels[peer];
	});
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

export type TransferState = Partial<{
	[peerID: string]: Partial<{ [fileID: string]: Transfer }>;
}>;

export const $transfers = map<TransferState>({});

export function getTransfer(peer: string, id: string): Transfer | undefined {
	return $transfers.get()[peer]?.[id];
}

export function addTransfer(peer: string, t: Transfer) {
	const transfers = { ...$transfers.get()[peer] };
	transfers[t.id] = t;
	$transfers.setKey(peer, transfers);
}

export function updateTransfer(
	peer: string,
	id: string,
	value: Partial<Transfer>,
) {
	const transfers = { ...$transfers.get()[peer] };
	if (!transfers) return;
	const prev = transfers[id];
	if (!prev) return;
	transfers[id] = { ...prev, ...value };
	$transfers.setKey(peer, transfers);
}

export function deleteTransfer(id: string) {
	Object.entries($transfers.get()).forEach(([peer, tr]) => {
		if (!tr) return;
		const transfers = { ...tr };
		if (id in transfers) {
			delete transfers[id];
			$transfers.setKey(peer, { ...transfers });
		}
	});
}

export function resetTransfers() {
	$transfers.set({});
}

export async function transferFile(
	chan: RTCDataChannel,
	receiver: string,
	file: File,
	meta: FileMetadata,
) {
	addTransfer(receiver, {
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
		const transfer = getTransfer(receiver, meta.id);
		if (!transfer) return;
		const bytes = transfer.transferredBytes + chunk.byteLength;
		updateTransfer(receiver, meta.id, {
			status: bytes === meta.size ? "complete" : "sending",
			transferredBytes: bytes,
		});
	});
}

export function requestFile(
	sender: string,
	sigchan: RTCDataChannel,
	file: FileMetadata,
) {
	addTransfer(sender, {
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
	receiver: string,
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
			deleteFileChannel(receiver, id);
			deleteTransfer(id);
		});
	});
}

// set up a channel for receiving
export function setupReceiveChannel(
	chan: RTCDataChannel,
	sender: string,
	id: string,
): RTCDataChannel {
	const tr = getTransfer(sender, id);
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
			const transfer = getTransfer(sender, id);
			if (transfer) {
				const bytes = transfer.transferredBytes + chunk.data.byteLength;
				updateTransfer(sender, id, {
					status: "receiving",
					transferredBytes: bytes,
				});
			}
			const file = filestore.getFile(chunk.fileID);
			if (!file) return;
			if (file.currentSize === file.metadata.size) {
				const stream = await filestore.getResult(chunk.fileID);
				const blob = await new Response(stream).blob();
				downloadBlob(blob, file.metadata.name);
				updateTransfer(sender, id, { status: "complete" });
				const complete = Object.values($transfers.get()).every((transfers) => {
					if (!transfers) return true;
					return Object.values(transfers).every(
						(t) => t?.status === "complete",
					);
				});
				if (complete) {
					deleteFileChannels();
				}
			}
		} catch (err) {
			console.error("filechannel:", err);
		}
	});
	chan.addEventListener("close", () => {
		deleteFileChannel(sender, id);
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
