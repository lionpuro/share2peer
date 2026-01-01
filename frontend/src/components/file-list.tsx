import type { LiHTMLAttributes, ReactNode } from "react";
import type { FileMetadata } from "#/lib/file";
import type { Transfer } from "#/lib/webrtc/transfer";
import { FileIcon } from "#/components/icons";
import { calcProgress, formatFileSize, toTitleCase } from "#/lib/helper";

export function FileList({ children }: { children?: ReactNode }) {
	return <ul className="flex flex-col gap-4">{children}</ul>;
}

export function FileListItem({
	file,
	transfer,
	...props
}: {
	file: FileMetadata;
	transfer?: Transfer;
} & LiHTMLAttributes<HTMLLIElement>) {
	return (
		<li {...props} className="flex items-center gap-2">
			<FileIcon mime={file.mime} />
			<div className="flex flex-1 flex-wrap gap-2 font-medium">
				<p className="text-sm font-medium">{file.name}</p>
				<span className="ml-auto text-sm text-neutral-500">
					{formatFileSize(file.size)}
				</span>
				{transfer ? (
					<div className="flex w-full items-center gap-2 text-sm">
						{transfer.status === "sending" ||
						transfer.status === "receiving" ||
						transfer.status === "waiting" ? (
							<>
								<progress
									value={calcProgress(
										transfer.transferredBytes,
										transfer.file.size,
									)}
									max={100}
									className="progress h-2 flex-1"
								></progress>
								<span className="font-medium text-muted-foreground">
									{calcProgress(transfer.transferredBytes, transfer.file.size)}%
								</span>
							</>
						) : (
							<p className="ml-auto text-muted-foreground">
								{toTitleCase(transfer.status)}
							</p>
						)}
					</div>
				) : null}
			</div>
		</li>
	);
}
