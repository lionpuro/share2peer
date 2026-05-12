import { useStore } from "@nanostores/react";
import { $peers } from "#/stores/peer";
import { createFileMetadata, type FileMetadata } from "#/lib/file";
import { useTransfers } from "#/hooks/transfer";
import { useFiles } from "#/hooks/use-files";
import {
	FileIcon,
	IconDownload,
	IconFile,
	IconReload,
	IconTrash,
	IconUpload,
	IconX,
} from "#/components/icons";
import { Button } from "#/components/ui/button";
import { FileInput } from "#/components/ui/file-input";
import { Heading } from "#/components/ui/heading";
import { Progress } from "#/components/ui/progress";
import { formatFileSize, toTitleCase } from "#/lib/helper";
import type { Transfer } from "#/stores/transfer";

export function FileArea() {
	const peers = useStore($peers);
	const { transfersByFile, stopTransfer } = useTransfers();
	const { uploadedFiles, peerFiles, addFiles, removeFile, downloadFile } =
		useFiles();
	const files: (FileMetadata & { uploader?: string })[] = [
		...uploadedFiles,
		...peerFiles,
	];

	const handleDrop = (files: File[]) => {
		const uploads = files.map((file) => {
			const meta = createFileMetadata(file);
			return { ...meta, file: file };
		});
		addFiles(uploads);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex gap-2">
				<span className="flex size-9.5 items-center justify-center rounded-lg bg-primary/20 text-lg text-primary">
					<IconFile />
				</span>
				<div className="flex flex-col">
					<Heading order={2}>Shared files</Heading>
					<p className="text-sm text-muted-foreground">
						{files.length} {files.length === 1 ? "file" : "files"}
					</p>
				</div>
			</div>
			{files.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{files.map((file) => {
						const transfers = transfersByFile[file.id] || [];
						const transfer =
							transfers.length > 0 ? getTransferState(transfers) : undefined;
						const sender = file.uploader
							? peers[file.uploader]?.username
							: undefined;
						return (
							<li
								key={"file-" + file.id}
								className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-1 rounded-lg bg-muted/70 p-2 pl-3"
							>
								<span className="mt-1 mr-2 flex size-6 items-start justify-center rounded-lg text-lg text-primary sm:text-xl">
									<FileIcon mime={file.mime} />
								</span>
								<div className="flex flex-col justify-between pb-0.5">
									<div className="flex">
										<div className="flex overflow-x-scroll">
											<p
												title={file.name}
												className="inline-block font-medium whitespace-nowrap max-sm:text-sm"
											>
												{file.name}
											</p>
										</div>
										{transfer && transfer.status === "active" && (
											<span className="ml-auto pl-2 text-sm text-muted-foreground">
												{transfer.progress}%
											</span>
										)}
									</div>
									{transfer &&
										(transfer.status === "active" ? (
											<Progress
												value={transfer.progress}
												max={100}
												className="w-full"
											/>
										) : file.uploader ? (
											<p className="text-sm leading-none text-muted-foreground">
												{toTitleCase(transfer.status)}
											</p>
										) : null)}
									{!transfer ||
									(!file.uploader && transfer.status !== "active") ? (
										<p className="text-sm leading-none text-muted-foreground">
											{formatFileSize(file.size)}
											<span className="mx-2">•</span>
											{sender || "You"}
										</p>
									) : null}
								</div>
								{!sender ? (
									<Button
										variant="ghost"
										className="size-9 self-center p-0 text-lg text-muted-foreground/80 hover:text-red-600"
										onClick={() => removeFile(file.id)}
										title="Remove"
									>
										<IconTrash />
									</Button>
								) : !transfer || transfer.status !== "active" ? (
									<Button
										variant="ghost"
										className="size-9 self-center p-0 text-lg text-muted-foreground/80 hover:text-primary"
										onClick={() => downloadFile(file.id)}
										title="Download"
									>
										{!transfer || transfer?.status === "waiting" ? (
											<IconDownload />
										) : (
											<IconReload />
										)}
									</Button>
								) : (
									<Button
										variant="ghost"
										className="size-9 self-center p-0 text-lg text-muted-foreground/80 hover:text-red-600"
										onClick={() =>
											transfersByFile[file.id]?.forEach((t) =>
												stopTransfer(t.id),
											)
										}
										title="Cancel transfer"
									>
										<IconX />
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			) : null}
			<FileInput
				className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-card/70 py-10 hover:border-primary/80 sm:py-16 dark:border-neutral-400/60 dark:border-secondary dark:bg-card"
				activeClassName="border-primary/80 bg-primary/10"
				multiple={true}
				onFileInput={handleDrop}
			>
				<IconUpload className="pointer-events-none mb-1 size-12 text-primary" />
				<span className="pointer-events-none text-center">Add files</span>
				<span className="pointer-events-none text-center text-sm text-muted-foreground">
					Drag and drop or click to browse
				</span>
			</FileInput>
		</div>
	);
}

function getTransferState(transfers: Transfer[]) {
	const transfer = transfers[0];
	if (transfers.length === 1 && transfer) {
		return { status: transfer.status, progress: transfer.progress };
	}

	const { status, current, total } = transfers.reduce(
		(acc, cur) => {
			const active = cur.status === "active";
			return {
				status: acc.status === "active" ? "active" : cur.status,
				current: !active ? acc.current : acc.current + cur.progress * cur.size,
				total: !active ? acc.total : acc.total + cur.size,
			};
		},
		{ status: "waiting" as Transfer["status"], current: 0, total: 0 },
	);

	const progress = total === 0 ? 0 : Math.round(current / total);
	return { status, progress };
}
