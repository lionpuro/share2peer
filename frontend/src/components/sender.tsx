import { useState } from "react";
import { useUploads } from "#/hooks/transfer";
import { createFileMetadata } from "#/lib/file";
import { Button } from "#/components/ui/button";
import { FileInput } from "#/components/ui/file-input";
import { Heading } from "#/components/ui/heading";
import { Progress } from "#/components/ui/progress";
import { FileList, FileListItem } from "#/components/file-list";
import { IconUpload } from "#/components/icons";

export function Sender() {
	const { files, start, stop, transferring, totalSize, currentSize } =
		useUploads();
	const progress = Math.round(currentSize / totalSize);
	const [selectedFiles, setSelectedFiles] = useState<typeof files>([]);
	const handleDrop = (files: File[]) => {
		const uploads = files.map((file) => {
			const meta = createFileMetadata(file);
			return { ...meta, file: file };
		});
		setSelectedFiles(uploads);
	};

	return (
		<div className="flex flex-col gap-4">
			{files.length > 0 ? (
				<>
					<Heading order={2} size="sm">
						Shared files
					</Heading>
					<FileList>
						{files.map((f) => (
							<FileListItem key={"up" + f.id} file={f} />
						))}
					</FileList>
					<div className="flex gap-2 max-sm:flex-col">
						<Button
							variant="secondary"
							size="sm"
							className="max-sm:mt-4 sm:ml-auto"
							onClick={stop}
						>
							Stop sharing
						</Button>
					</div>
					{transferring ? (
						<div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
							<span className="w-full text-sm font-medium text-muted-foreground">
								Transfer progress
							</span>
							<Progress value={progress} max={100} />
							<span className="text-sm font-medium text-muted-foreground">
								{progress}%
							</span>
						</div>
					) : null}
				</>
			) : selectedFiles.length > 0 ? (
				<>
					<Heading order={2} size="sm">
						Selected files ({selectedFiles.length})
					</Heading>
					<FileList>
						{selectedFiles.map((f) => (
							<FileListItem key={"up" + f.id} file={f} />
						))}
					</FileList>
					<div className="flex gap-2 sm:ml-auto sm:w-48">
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setSelectedFiles([])}
							className="basis-1/2"
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={() => start(selectedFiles)}
							className="basis-1/2"
						>
							Share
						</Button>
					</div>
				</>
			) : (
				<>
					<Heading order={2} size="sm">
						Share files
					</Heading>
					<FileInput
						className="flex flex-col items-center justify-center rounded-lg rounded-xl border-2 border-dashed border-neutral-400/60 py-10 sm:py-16"
						activeClassName="sm:border-primary/80 sm:bg-primary/10"
						multiple={true}
						onFileInput={handleDrop}
					>
						<IconUpload className="pointer-events-none size-9 text-neutral-400" />
						<span className="pointer-events-none mt-1 text-center text-sm font-medium text-muted-foreground">
							Click to browse or drop files here
						</span>
						<span className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker">
							Browse files
						</span>
					</FileInput>
				</>
			)}
		</div>
	);
}
