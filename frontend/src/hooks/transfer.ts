import { useStore } from "@nanostores/react";
import { $transfers, removeTransfer, type Transfer } from "#/stores/transfer";

export function useTransfers() {
	const transfers = useStore($transfers);
	const state = Object.values(transfers).reduce(
		(acc, tr) => {
			const ignore = tr.status === "canceled";
			return {
				active: acc.active || tr.status === "active" ? true : false,
				totalSize: ignore ? acc.totalSize : acc.totalSize + tr.size,
				currentSize: ignore
					? acc.totalSize
					: acc.currentSize + tr.progress * tr.size,
				byFile: {
					...acc.byFile,
					[tr.fileID]: [...(acc.byFile[tr.fileID] || []), tr],
				},
			};
		},
		{
			active: false,
			totalSize: 0,
			currentSize: 0,
			byFile: {},
		} as {
			active: boolean;
			totalSize: number;
			currentSize: number;
			byFile: Record<string, Transfer[]>;
		},
	);

	const stopTransfer = (id: string) => {
		const transfer = transfers[id];
		if (!transfer) return;
		transfer.channel?.close();
		removeTransfer(id);
	};

	return {
		transfers,
		transfersByFile: state.byFile,
		transferring: state.active,
		totalSize: state.totalSize,
		currentSize: state.currentSize,
		stopTransfer,
	};
}
