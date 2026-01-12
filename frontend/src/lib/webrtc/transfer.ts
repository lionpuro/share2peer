import { type MapStore, computed, map } from "nanostores";
import { ChunkReader, downloadBlob, filestore } from "#/lib/file";
import { createDataChannel, sendPacket, sendSignal } from "./datachannel";
import { decodeChunk, encodeChunk } from "./protocol";
import { nanoid } from "nanoid";
import { type Peer, findPeer } from "./peer";

const channels: Map<string, RTCDataChannel> = new Map();

function closeChannel(id: string) {
	const chan = channels.get(id);
	if (chan && chan.readyState !== "closing" && chan.readyState !== "closed") {
		chan.close();
	}
	channels.delete(id);
}

type TransferStatus =
	| "waiting"
	| "transferring"
	| "complete"
	| "stopped"
	| "failed";

export type Transfer = {
	id: string;
	peerID: string;
	fileID: string;
	status: TransferStatus;
	transferredBytes: number;
	totalBytes: number;
};

type TransferState = {
	transfers: Partial<{ [transferID: string]: Transfer }>;
	byPeer: { [peerID: string]: Set<string> };
	byFile: { [fileID: string]: Set<string> };
};

type TransferStore = MapStore<TransferState>;

export const $incoming = map<TransferState>({
	transfers: {},
	byPeer: {},
	byFile: {},
});

export const $outgoing = map<TransferState>({
	transfers: {},
	byPeer: {},
	byFile: {},
});

export const $outgoingState = computed($outgoing, (val) => {
	const tr = Object.values(val.transfers).filter(
		(t) => t?.status !== "stopped" && t?.status !== "failed",
	);
	const total = tr.reduce((acc, cur) => acc + (cur?.totalBytes ?? 0), 0);
	const current = tr.reduce(
		(acc, cur) => acc + (cur?.transferredBytes ?? 0),
		0,
	);
	const progress = total === 0 ? 0 : (current / total) * 100;
	const status =
		progress === 100
			? "complete"
			: tr.length === 0
				? "waiting"
				: "transferring";
	return {
		status: status,
		progress: Math.round(progress),
	};
});

export function stopTransfers(store: TransferStore, transferIDs: string[]) {
	transferIDs.forEach((id) => {
		closeChannel(id);
		removeTransfer(store, id);
	});
}

export function listTransfers(store: TransferStore): Transfer[] {
	return Object.values(store.get().transfers) as Transfer[];
}

export function findTransfer(
	store: TransferStore,
	id: string,
): Transfer | undefined {
	return store.get().transfers[id];
}

export function findTransfersByPeer(
	store: TransferStore,
	peerID: string,
): Transfer[] {
	const state = store.get();
	const ids = state.byPeer[peerID] || new Set();
	return Array.from(ids)
		.map((id) => state.transfers[id])
		.filter((v) => !!v);
}

export function findTransfersByFile(
	store: TransferStore,
	fileID: string,
): Transfer[] {
	const state = store.get();
	const ids = state.byFile[fileID] || new Set();
	return Array.from(ids)
		.map((id) => state.transfers[id])
		.filter((v) => !!v);
}

export function addTransfer(store: TransferStore, t: Transfer) {
	const state = store.get();
	const updated = {
		transfers: { ...state.transfers, [t.id]: t },
		byPeer: {
			...state.byPeer,
			[t.peerID]: new Set([...(state.byPeer[t.peerID] || new Set()), t.id]),
		},
		byFile: {
			...state.byFile,
			[t.fileID]: new Set([...(state.byFile[t.fileID] || new Set()), t.id]),
		},
	};
	store.set(updated);
}

export function updateTransfer(
	store: TransferStore,
	id: string,
	update: Partial<Transfer>,
): TransferState | undefined {
	const state = store.get();
	const transfer = state.transfers[id];
	if (!transfer) return;
	store.setKey("transfers", {
		...state.transfers,
		[id]: { ...transfer, ...update },
	});
}

export function removeTransfer(
	store: TransferStore,
	id: string,
): TransferState | undefined {
	const state = store.get();
	const transfer = state.transfers[id];
	if (!transfer) return;

	const transfers = { ...state.transfers };
	delete transfers[id];

	const peerSet = state.byPeer[transfer.peerID] || new Set();
	peerSet.delete(id);
	const byPeer = { ...state.byPeer, [transfer.peerID]: peerSet };
	if (peerSet.size === 0) {
		delete byPeer[transfer.peerID];
	}

	const fileSet = state.byFile[transfer.fileID] || new Set();
	fileSet.delete(id);
	const byFile = { ...state.byFile, [transfer.fileID]: fileSet };
	if (fileSet.size === 0) {
		delete byPeer[transfer.fileID];
	}

	store.set({ transfers, byPeer, byFile });
}

export type TransferContext = {
	transferID: string;
	peerID: string;
	fileID: string;
	fileSize: number;
};

export async function handleStartTransfer(
	peerID: string,
	fileID: string,
	file: File,
) {
	const ctx: TransferContext = {
		transferID: nanoid(),
		peerID: peerID,
		fileID: fileID,
		fileSize: file.size,
	};
	addTransfer($outgoing, {
		id: ctx.transferID,
		peerID: ctx.peerID,
		fileID: ctx.fileID,
		status: "waiting",
		transferredBytes: 0,
		totalBytes: ctx.fileSize,
	});
	try {
		const chan = await createSendChannel(ctx);
		channels.set(ctx.transferID, chan);
		sendFile(ctx, file);
	} catch (err) {
		console.error(err);
		removeTransfer($outgoing, ctx.transferID);
	}
}

async function createSendChannel(
	ctx: TransferContext,
): Promise<RTCDataChannel> {
	const peer = findPeer(ctx.peerID);
	if (!peer) {
		throw new Error("peer not found");
	}

	const chan = await createDataChannel(peer.connection, `file-${ctx.fileID}`);
	chan.addEventListener("close", () => {
		const transfer = findTransfer($outgoing, ctx.transferID);
		if (transfer && transfer.status !== "complete") {
			updateTransfer($outgoing, ctx.transferID, { status: "stopped" });
		}
		closeChannel(ctx.transferID);
	});
	chan.addEventListener("error", () => {
		const transfer = findTransfer($outgoing, ctx.transferID);
		if (transfer) {
			updateTransfer($outgoing, ctx.transferID, { status: "failed" });
		}
		closeChannel(ctx.transferID);
	});

	return chan;
}

export function requestFile(peer: Peer, fileID: string) {
	const file = peer.files.find((f) => f.id === fileID);
	if (!file) return;

	const ctx: TransferContext = {
		transferID: nanoid(),
		peerID: peer.id,
		fileID: fileID,
		fileSize: file.size,
	};
	addTransfer($incoming, {
		id: ctx.transferID,
		peerID: ctx.peerID,
		fileID: ctx.fileID,
		status: "waiting",
		transferredBytes: 0,
		totalBytes: ctx.fileSize,
	});
	filestore.addFile(file);

	sendSignal(peer.signalChannel, {
		type: "request-file",
		payload: { file_id: file.id },
	});
}

export function handleIncomingTransfer(
	fileID: string,
	chan: RTCDataChannel,
): RTCDataChannel {
	chan.binaryType = "arraybuffer";
	const transfer = findTransfersByFile($incoming, fileID).at(0);
	if (!transfer || !filestore.getFile(fileID)) {
		chan.close();
		throw new Error("incoming transfer not registered for file " + fileID);
	}

	const id = transfer.id;
	channels.set(id, chan);

	chan.addEventListener("message", async (e) => {
		if (!(e.data instanceof ArrayBuffer)) {
			console.error("filechannel: unrecognized message type");
			return;
		}
		try {
			const chunk = decodeChunk(e.data as ArrayBuffer);
			filestore.addChunk(chunk);
			const t = findTransfer($incoming, id);
			if (t) {
				const bytes = t.transferredBytes + chunk.data.byteLength;
				updateTransfer($incoming, id, {
					status: "transferring",
					transferredBytes: bytes,
				});
			}
			const file = filestore.getFile(chunk.fileID);
			if (!file) return;
			if (file.currentSize === file.metadata.size) {
				const stream = await filestore.getResult(chunk.fileID);
				const blob = await new Response(stream).blob();
				downloadBlob(blob, file.metadata.name);
				updateTransfer($incoming, id, { status: "complete" });
				closeChannel(id);
			}
		} catch (err) {
			console.error("filechannel:", err);
		}
	});
	chan.addEventListener("close", () => {
		closeChannel(id);
		filestore.removeFile(id);
	});

	return chan;
}

async function sendFile(ctx: TransferContext, file: File) {
	const chan = channels.get(ctx.transferID);
	if (!chan) return;

	updateTransfer($outgoing, ctx.transferID, { status: "transferring" });

	const reader = new ChunkReader();
	await reader.read(file, async (chunk, index) => {
		if (!chan || chan.readyState !== "open") {
			reader.stop();
			return;
		}
		const packet = encodeChunk({
			fileID: ctx.fileID,
			index: index,
			data: chunk,
		});
		await sendPacket(chan, packet);
		const transfer = findTransfer($outgoing, ctx.transferID);
		if (!transfer) return;
		const bytes = transfer.transferredBytes + chunk.byteLength;
		const complete = bytes === ctx.fileSize;
		updateTransfer($outgoing, ctx.transferID, {
			status: complete ? "complete" : transfer.status,
			transferredBytes: bytes,
		});
	});
}
