import { useStore } from "@nanostores/react";
import {
	$transfers,
	listTransfers,
	removeTransfer,
	type Transfer,
} from "#/stores/transfer";
import { broadcast, findConnection } from "#/lib/webrtc";
import { startDownload } from "#/lib/webrtc/transfer";
import { $peers } from "#/stores/peer";
import { $uploads, setUploads } from "#/stores/file";

export function useUploads() {
	const files = useStore($uploads);
	const transfers = useStore($transfers);
	const uploads = Object.values(transfers).filter(
		(t) => !!t && t.status !== "canceled" && t.type === "upload",
	) as Transfer[];
	const state = uploads.reduce(
		(acc, tr) => {
			if (tr.status === "canceled") {
				return acc;
			}
			return {
				total: acc.total + tr.size,
				current: acc.current + tr.progress * tr.size,
				active: acc.active || tr.status === "active" ? true : false,
			};
		},
		{ total: 0, current: 0, active: false },
	);

	const start = (uploads: typeof files) => {
		if (uploads.length > 0) {
			setUploads(uploads);
			broadcast({
				type: "share-files",
				payload: {
					files: uploads.map((u) => ({
						id: u.id,
						name: u.name,
						mime: u.mime,
						size: u.size,
					})),
				},
			});
		}
	};

	const stop = () => {
		broadcast({ type: "cancel-share" });
		listTransfers().forEach((t) => {
			if (t?.type === "upload") {
				t.channel?.close();
				removeTransfer(t.id);
			}
		});
		setUploads([]);
	};

	return {
		files,
		uploads,
		transferring: state.active,
		totalSize: state.total,
		currentSize: state.current,
		start,
		stop,
	};
}

export function useDownloads() {
	const peers = useStore($peers);
	const files = Object.values(peers).flatMap((p) => {
		return p?.files.map((f) => ({ ...f, peerID: p.id })) || [];
	});
	const transfers = useStore($transfers);
	const downloads = Object.values(transfers).filter(
		(t) => !!t && t.type === "download",
	) as Transfer[];

	const state = downloads.reduce(
		(acc, tr) => {
			return {
				active: acc.active || tr.status === "active" ? true : false,
				totalSize: acc.totalSize + tr.size,
				currentSize: acc.currentSize + tr.progress * tr.size,
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
			byFile: Partial<Record<string, Transfer[]>>;
		},
	);

	const start = async () => {
		for (const file of files) {
			const conn = findConnection(file.peerID);
			if (conn) {
				await startDownload(file, conn);
			}
		}
	};

	const stop = () => {
		listTransfers().forEach((t) => {
			if (t?.type === "download") {
				t.channel?.close();
				removeTransfer(t.id);
			}
		});
	};

	return {
		files,
		downloads,
		transfersByFile: state.byFile,
		transferring: state.active,
		totalSize: state.totalSize,
		currentSize: state.currentSize,
		start,
		stop,
	};
}
