import { useStore } from "@nanostores/react";
import { $transfers, removeTransfer, type Transfer } from "#/stores/transfer";

export function useTransfers() {
	const map = useStore($transfers);
	const transfers = Object.values(map);
	const state = transfers.reduce(
		(acc, tr) => {
			if (tr.status === "canceled") {
				return acc;
			}
			return {
				byFile: {
					...acc.byFile,
					[tr.fileID]: [...(acc.byFile[tr.fileID] || []), tr],
				},
			};
		},
		{
			byFile: {},
		} as {
			byFile: Record<string, Transfer[]>;
		},
	);

	const stopTransfer = (id: string) => {
		const transfer = map[id];
		transfer?.channel?.close();
		removeTransfer(id);
	};

	return {
		transfers,
		transfersByFile: state.byFile,
		stopTransfer,
	};
}
