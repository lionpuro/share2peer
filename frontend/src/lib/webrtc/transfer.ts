import { type MapStore, map } from "nanostores";
import { nanoid } from "nanoid";
import { ChunkReader, type FileMetadata } from "#/lib/file";
import { sendPacket } from "./datachannel";
import { decodeChunk, encodeChunk } from "./protocol";
import { PeerConnection } from "./peer";
import {
	createBlobWriteStream,
	createDefaultWriteStream,
	createDownload,
	type Download,
} from "#/lib/file/download";

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
	channel: RTCDataChannel | null;
};

type TransferStoreValue = {
	transfers: Partial<{ [transferID: string]: Transfer }>;
	byPeer: { [peerID: string]: Set<string> };
	byFile: { [fileID: string]: Set<string> };
};

type TransferState = {
	status: TransferStatus | null;
	progress: number;
	byTransfer: {
		[id: string]: { status: TransferStatus | null; progress: number };
	};
};

function updateTransferState(
	store: MapStore<TransferState>,
	value: Partial<TransferState>,
) {
	store.set({ ...store.get(), ...value });
}

type TransferStoreOptions = {
	onUpdate?(val: TransferStoreValue): void;
};

class TransferStore {
	#state: TransferStoreValue = { transfers: {}, byPeer: {}, byFile: {} };
	#options: TransferStoreOptions;

	constructor(opts: TransferStoreOptions = {}) {
		this.#options = opts;
	}

	find(id: string): Transfer | undefined {
		return this.#state.transfers[id];
	}

	findByPeer(peerID: string): Transfer[] {
		const ids = this.#state.byPeer[peerID] || new Set();
		return Array.from(ids)
			.map((id) => this.#state.transfers[id])
			.filter((v) => !!v);
	}

	findByFile(fileID: string): Transfer[] {
		const ids = this.#state.byFile[fileID] || new Set();
		return Array.from(ids)
			.map((id) => this.#state.transfers[id])
			.filter((v) => !!v);
	}

	list(): Transfer[] {
		return Object.values(this.#state.transfers).filter((t): t is Transfer => {
			return t !== undefined;
		});
	}

	add(t: Transfer) {
		const state = this.#state;
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
		this.#state = updated;
		this.#options.onUpdate?.(this.#state);
	}

	update(id: string, update: Partial<Transfer>) {
		const transfer = this.#state.transfers[id];
		if (!transfer) return;
		this.#state.transfers = {
			...this.#state.transfers,
			[id]: { ...transfer, ...update },
		};
		this.#options.onUpdate?.(this.#state);
	}

	remove(...ids: string[]) {
		ids.forEach((id) => this.#remove(id));
		this.#options.onUpdate?.(this.#state);
	}

	#remove(id: string) {
		const state = this.#state;
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

		this.#state = { transfers, byPeer, byFile };
	}
}

export const $incoming = map<TransferState>({
	status: null,
	progress: 0,
	byTransfer: {},
});

export const $outgoing = map<TransferState>({
	status: null,
	progress: 0,
	byTransfer: {},
});

export const incoming = new TransferStore({
	onUpdate: (val) => {
		updateTransferState($incoming, computeTransferState(val));
	},
});
export const outgoing = new TransferStore({
	onUpdate: (val) => {
		updateTransferState($outgoing, computeTransferState(val));
	},
});

export function stopTransfers(store: TransferStore, transferIDs: string[]) {
	transferIDs.forEach((id) => {
		const chan = store.find(id)?.channel;
		if (chan?.readyState === "open") {
			chan.close();
		}
		store.remove(id);
	});
}

function computeTransferState(value: TransferStoreValue): TransferState {
	const transfers = Object.values(value.transfers).filter(
		(t): t is Transfer =>
			!!t && t?.status !== "stopped" && t?.status !== "failed",
	);

	let total = 0;
	let current = 0;
	const byTransfer: TransferState["byTransfer"] = {};

	transfers.forEach((t) => {
		total += t.totalBytes;
		current += t.transferredBytes;
		byTransfer[t.id] = {
			status: t.status,
			progress: Math.round((t.transferredBytes / t.totalBytes) * 100),
		};
	});

	const progress = total === 0 ? 0 : (current / total) * 100;
	const status =
		progress === 100
			? "complete"
			: transfers.length > 0
				? "transferring"
				: null;

	return {
		status,
		progress: Math.round(progress),
		byTransfer,
	};
}

export type TransferContext = {
	transferID: string;
	peerID: string;
	fileID: string;
	fileSize: number;
};

export async function handleStartTransfer(
	conn: PeerConnection,
	fileID: string,
	file: File,
) {
	const ctx: TransferContext = {
		transferID: nanoid(),
		peerID: conn.id,
		fileID: fileID,
		fileSize: file.size,
	};
	try {
		const chan = await conn.createFileChannel(fileID);
		chan.addEventListener("close", () => {
			const transfer = outgoing.find(ctx.transferID);
			if (transfer && transfer.status !== "complete") {
				outgoing.update(ctx.transferID, { status: "stopped", channel: null });
			}
		});
		chan.addEventListener("error", () => {
			const transfer = outgoing.find(ctx.transferID);
			if (transfer) {
				outgoing.update(ctx.transferID, { status: "failed", channel: null });
			}
		});
		outgoing.add({
			id: ctx.transferID,
			peerID: ctx.peerID,
			fileID: ctx.fileID,
			status: "waiting",
			transferredBytes: 0,
			totalBytes: ctx.fileSize,
			channel: chan,
		});
		sendFile(ctx, file);
	} catch (err) {
		console.error(err);
		outgoing.remove(ctx.transferID);
	}
}

const streamSupported = !("safari" in window) && !("WebKitPoint" in window);

const downloads: Map<string, Download> = new Map();

export async function requestFile(conn: PeerConnection, file: FileMetadata) {
	const ctx: TransferContext = {
		transferID: nanoid(),
		peerID: conn.id,
		fileID: file.id,
		fileSize: file.size,
	};
	incoming.add({
		id: ctx.transferID,
		peerID: ctx.peerID,
		fileID: ctx.fileID,
		status: "waiting",
		transferredBytes: 0,
		totalBytes: ctx.fileSize,
		channel: null,
	});

	const writable = streamSupported
		? await createDefaultWriteStream(file.name, file.size)
		: createBlobWriteStream(file.name, file.mime);
	const download = await createDownload(writable);
	downloads.set(ctx.transferID, download);

	conn.send({
		type: "request-file",
		payload: { file_id: file.id },
	});
}

export async function handleIncomingTransfer(
	fileID: string,
	chan: RTCDataChannel,
): Promise<RTCDataChannel> {
	chan.binaryType = "arraybuffer";
	const transfer = incoming.findByFile(fileID).at(0);
	if (!transfer) {
		chan.close();
		incoming.remove(fileID);
		throw new Error("incoming transfer not registered for file " + fileID);
	}
	const download = downloads.get(transfer.id);
	if (!download) {
		chan.close();
		incoming.remove(fileID);
		throw new Error("no download registered for file " + fileID);
	}

	const id = transfer.id;
	incoming.update(id, { channel: chan });

	chan.addEventListener("message", async (e) => {
		const data: unknown = e.data;
		if (!(data instanceof ArrayBuffer)) {
			console.error("filechannel: unrecognized message type");
			return;
		}
		try {
			const chunk = decodeChunk(data);

			download.enqueue(chunk.data);

			const current = incoming.find(id);
			if (!current) return;
			const bytes = current.transferredBytes + chunk.data.byteLength;

			incoming.update(id, {
				status: "transferring",
				transferredBytes: bytes,
			});

			if (bytes === current.totalBytes) {
				download.close();
			}
		} catch (err) {
			console.error("filechannel:", err);
		}
	});
	chan.addEventListener("close", () => {
		incoming.update(id, { channel: null });
	});

	download
		.start()
		.then(() => {
			console.log("download finished");
			incoming.update(id, { status: "complete" });
			chan.close();
		})
		.catch((err) => {
			console.error("download:", err);
			incoming.update(id, { status: "failed" });
			chan.close();
		});

	return chan;
}

async function sendFile(ctx: TransferContext, file: File) {
	const chan = outgoing.find(ctx.transferID)?.channel;
	if (!chan) {
		outgoing.update(ctx.transferID, { status: "failed" });
		return;
	}

	outgoing.update(ctx.transferID, { status: "transferring" });

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
		const current = outgoing.find(ctx.transferID);
		if (!current) return;
		const bytes = current.transferredBytes + chunk.byteLength;
		const complete = bytes === ctx.fileSize;
		outgoing.update(ctx.transferID, {
			status: complete ? "complete" : current.status,
			transferredBytes: bytes,
		});
	});
}
