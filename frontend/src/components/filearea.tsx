import { useStore } from "@nanostores/react";
import { $peers } from "#/stores/peer";
import { createFileMetadata, type FileMetadata } from "#/lib/file";
import { useTransfers } from "#/hooks/transfer";
import { useFiles } from "#/hooks/use-files";
import {
	FileIcon,
	IconDownload,
	IconReload,
	IconStop,
	IconUpload,
	IconX,
} from "#/components/icons";
import { Button } from "#/components/ui/button";
import { FileInput } from "#/components/ui/file-input";
import { Heading } from "#/components/ui/heading";
import { Progress } from "#/components/ui/progress";
import { formatFileSize, toTitleCase } from "#/lib/helper";

export function FileArea() {
	const peers = useStore($peers);
	const {
		transfersByFile,
		stopTransfer,
		transferring,
		currentSize,
		totalSize,
	} = useTransfers();
	const { uploadedFiles, peerFiles, addFiles, removeFile, downloadFile } =
		useFiles();
	const files: (FileMetadata & { uploader?: string })[] = [
		...uploadedFiles,
		...peerFiles,
	];
	const progress = Math.round(currentSize / totalSize);

	const handleDrop = (files: File[]) => {
		const uploads = files.map((file) => {
			const meta = createFileMetadata(file);
			return { ...meta, file: file };
		});
		addFiles(uploads);
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading order={2}>
				{files.length > 0 ? "Shared files" : "Share files"}
			</Heading>
			{files.length > 0 ? (
				<ul className="-mr-2 mb-2 flex flex-col gap-2">
					{files.map((file) => {
						const transfer = file.uploader
							? transfersByFile[file.id]?.[0]
							: undefined;
						const sender = file.uploader
							? peers[file.uploader]?.display_name
							: undefined;
						return (
							<li key={"file-" + file.id} className="flex gap-2">
								<span className="flex size-10 items-center justify-center rounded-lg bg-primary/20 text-xl text-[#45a568]">
									<FileIcon mime={file.mime} />
								</span>
								<div className="flex flex-1 flex-col justify-between py-1">
									<p className="flex leading-none font-medium">{file.name}</p>
									{transfer &&
										(transfer.status === "active" ||
										transfer.status === "waiting" ? (
											<Progress
												value={transfer.progress}
												max={100}
												className="w-full"
											/>
										) : (
											<p className="text-sm leading-none font-medium text-muted-foreground">
												{toTitleCase(transfer.status)}
											</p>
										))}
									{!transfer && (
										<p className="text-sm leading-none font-medium text-muted-foreground">
											{formatFileSize(file.size)}
											<span className="mx-2">•</span>
											{sender || "You"}
										</p>
									)}
								</div>
								{!sender ? (
									<Button
										variant="ghost"
										className="aspect-square p-2 text-lg text-red-600/80 hover:text-red-600"
										onClick={() => removeFile(file.id)}
										title="Remove"
									>
										<IconX />
									</Button>
								) : !transfer || transfer.status !== "active" ? (
									<Button
										variant="ghost"
										className="aspect-square p-2 text-lg text-muted-foreground/80 hover:text-primary"
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
										className="aspect-square p-2 text-lg text-red-600/80 hover:text-red-600"
										onClick={() => stopTransfer(transfer.id)}
										title="Stop"
									>
										<IconStop />
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			) : null}
			{transferring && (
				<div className="flex flex-1 flex-wrap gap-2">
					<p className="flex w-full text-sm leading-none font-medium text-muted-foreground">
						Total progress
						<span className="ml-auto">{progress}%</span>
					</p>
					<Progress value={progress} max={100} className="flex-1" />
				</div>
			)}
			<FileInput
				className="flex flex-col items-center justify-center rounded-lg rounded-xl border-2 border-dashed border-neutral-400/60 py-10 hover:border-primary/80 sm:py-16"
				activeClassName="border-primary/80 bg-primary/10"
				multiple={true}
				onFileInput={handleDrop}
			>
				<IconUpload className="pointer-events-none mb-1 size-12 text-neutral-400" />
				<span className="pointer-events-none text-center font-medium">
					Select files to share
				</span>
				<span className="pointer-events-none text-center text-sm font-medium text-muted-foreground">
					Drag and drop or click to browse
				</span>
			</FileInput>
		</div>
	);
}
