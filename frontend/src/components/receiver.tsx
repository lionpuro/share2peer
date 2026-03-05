import type { PeerState } from "#/stores/peer";
import { useDownloads } from "#/hooks/transfer";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { FileList, FileListItem } from "#/components/file-list";
import { IconDownload, IconX } from "#/components/icons";

export function Receiver({ peers }: { peers: Record<string, PeerState> }) {
	const { files, downloads, transfersByFile, stop, start, transferring } =
		useDownloads();
	return (
		<div className="flex flex-col gap-4">
			<Heading order={2} className="mb-1">
				Receive
			</Heading>
			{files.length === 0 ? (
				<span className="leading-none text-muted-foreground">
					Waiting for incoming files
				</span>
			) : (
				<>
					<FileList>
						{files.map((f) => (
							<FileListItem
								key={"file" + f.id}
								file={f}
								transfer={transfersByFile[f.id]?.[0]}
								sender={peers[f.peerID]?.display_name}
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
