import type { Room } from "#/lib/schemas";
import type { PeerState } from "#/stores/peer";
import { useDownloads } from "#/hooks/transfer";
import { Loader } from "#/components/ui/loader";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { FileList, FileListItem } from "#/components/file-list";
import { IconDownload, IconX } from "#/components/icons";

export function Receiver({
	room,
	peers,
}: {
	room: Room;
	peers: Record<string, PeerState>;
}) {
	const { files, downloads, transfersByFile, stop, start, transferring } =
		useDownloads();
	const host = room.host ? peers[room.host] : undefined;
	const loading = !host || host.files === undefined;

	if (loading) {
		return <Loader />;
	}
	return (
		<div className="flex flex-col gap-4">
			{files.length === 0 ? (
				<span className="text-center text-muted-foreground">
					Waiting for files
				</span>
			) : (
				<>
					<Heading order={2} size="sm">
						Files
					</Heading>
					<FileList>
						{files.map((f) => (
							<FileListItem
								key={"file" + f.id}
								file={f}
								transfer={transfersByFile[f.id]?.[0]}
							/>
						))}
					</FileList>
					{downloads.length === 0 ? (
						<Button
							variant="primary"
							size="sm"
							className="gap-1.5 sm:ml-auto sm:pl-3"
							onClick={start}
						>
							<IconDownload />
							Download ({files.length})
						</Button>
					) : transferring ? (
						<Button
							variant="secondary"
							size="sm"
							className="gap-1.5 sm:ml-auto sm:pl-3"
							onClick={stop}
						>
							<IconX />
							Cancel download
						</Button>
					) : null}
				</>
			)}
		</div>
	);
}
