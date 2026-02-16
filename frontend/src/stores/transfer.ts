import { map } from "nanostores";

export type TransferStatus = "waiting" | "active" | "complete" | "canceled";

export type Transfer = {
	type: "download" | "upload";
	id: string;
	fileID: string;
	peer: string;
	size: number;
	progress: number;
	status: TransferStatus;
	channel: RTCDataChannel | undefined;
};

export type TransferStoreValue = Partial<Record<string, Transfer>>;

export const $transfers = map<TransferStoreValue>({});

export function listTransfers(): Transfer[] {
	return Object.values($transfers.get()) as Transfer[];
}

export function addTransfer(v: Transfer) {
	$transfers.setKey(v.id, v);
}

export function findTransfer(id: string): Transfer | undefined {
	return $transfers.get()[id];
}

export function findTransfersByFile(fileID: string): Transfer[] {
	const transfers = Object.values($transfers.get()) as Transfer[];
	return transfers.filter((t) => t?.fileID === fileID);
}

export function findTransfersByPeer(peerID: string): Transfer[] {
	const transfers = Object.values($transfers.get()) as Transfer[];
	return transfers.filter((t) => t?.peer === peerID);
}

export function updateTransfer(
	id: string,
	update: Partial<Transfer> | ((prev: Transfer) => Transfer),
) {
	const prev = $transfers.get()[id];
	if (!prev) return;
	if (typeof update === "function") {
		$transfers.setKey(id, { ...update(prev) });
		return;
	}
	$transfers.setKey(id, { ...prev, ...update });
}

export function removeTransfer(id: string) {
	const state = { ...$transfers.get() };
	delete state[id];
	$transfers.set(state);
}
