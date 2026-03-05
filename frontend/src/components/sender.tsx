import { useState } from "react";
import { useUploads } from "#/hooks/transfer";
import { createFileMetadata } from "#/lib/file";
import { Button } from "#/components/ui/button";
import { FileInput } from "#/components/ui/file-input";
import { Heading } from "#/components/ui/heading";
import { Progress } from "#/components/ui/progress";
import { FileList, FileListItem } from "#/components/file-list";
import { IconStop, IconUpload } from "#/components/icons";

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
			<Heading order={2} className="mb-1">
				Send
			</Heading>
			{files.length > 0 ? (
				<>
					<FileList>
						{files.map((f) => (
							<FileListItem key={"up" + f.id} file={f} />
						))}
					</FileList>
					<div className="flex items-center gap-4">
						{transferring && (
							<div className="flex flex-1 flex-wrap gap-2">
								<p className="flex w-full text-sm leading-none font-medium text-muted-foreground">
									Sending
									<span className="ml-auto">{progress}%</span>
								</p>
								<Progress value={progress} max={100} className="flex-1" />
							</div>
						)}
						<button
							className="ml-auto flex items-center gap-1 py-2 text-sm font-medium text-red-600/80 hover:text-red-600"
							onClick={stop}
						>
							<IconStop />
							Stop
						</button>
					</div>
				</>
			) : selectedFiles.length > 0 ? (
				<>
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
				<FileInput
					className="flex flex-col items-center justify-center rounded-lg rounded-xl border-2 border-dashed border-neutral-400/60 py-10 hover:border-primary/80 sm:py-16"
					activeClassName="sm:border-primary/80 sm:bg-primary/10"
					multiple={true}
					onFileInput={handleDrop}
				>
					<IconUpload className="pointer-events-none size-9 text-neutral-400" />
					<span className="pointer-events-none mt-1 text-center text-sm font-medium text-muted-foreground">
						Select files to share
					</span>
					<span className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker">
						Browse files
					</span>
				</FileInput>
			)}
		</div>
	);
}
