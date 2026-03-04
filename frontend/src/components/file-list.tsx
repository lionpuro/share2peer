import type { LiHTMLAttributes, ReactNode } from "react";
import type { FileMetadata } from "#/lib/file";
import { FileIcon } from "#/components/icons";
import { cn, formatFileSize, toTitleCase } from "#/lib/helper";
import type { TransferStatus } from "#/stores/transfer";
import { Progress } from "./ui/progress";

export function FileList({
	className,
	children,
}: {
	className?: string;
	children?: ReactNode;
}) {
	return <ul className={cn("flex flex-col gap-2", className)}>{children}</ul>;
}

interface TransferState {
	status: TransferStatus;
	progress: number;
}

export function FileListItem({
	file,
	transfer,
	className,
	...props
}: {
	file: FileMetadata;
	transfer?: TransferState;
} & LiHTMLAttributes<HTMLLIElement>) {
	return (
		<li {...props} className={cn(className, "flex gap-2")}>
			<span className="flex size-10 items-center justify-center rounded-lg bg-primary/20 text-xl text-[#45a568]">
				<FileIcon mime={file.mime} />
			</span>
			<div className="flex flex-1 flex-col justify-between py-1">
				<p className="flex text-sm leading-none font-medium">
					{file.name}
					<span className="ml-auto text-muted-foreground">
						{formatFileSize(file.size)}
					</span>
				</p>
				{transfer && (
					<div className="flex w-full items-center gap-2 text-sm">
						{transfer.status === "active" || transfer.status === "waiting" ? (
							<>
								<Progress
									value={transfer.progress}
									max={100}
									className="flex-1"
								/>
								<span className="font-medium text-muted-foreground">
									{transfer.progress}%
								</span>
							</>
						) : (
							<p className="ml-auto text-muted-foreground">
								{toTitleCase(transfer.status)}
							</p>
						)}
					</div>
				)}
			</div>
		</li>
	);
}
