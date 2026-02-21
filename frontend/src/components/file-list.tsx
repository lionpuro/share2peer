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
	return (
		<ul
			className={cn(
				"flex flex-col gap-px overflow-hidden rounded-xl border bg-neutral-200",
				className,
			)}
		>
			{children}
		</ul>
	);
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
		<li
			{...props}
			className={cn(
				"flex min-h-17 items-center gap-2 bg-background px-4 py-3",
				className,
			)}
		>
			<FileIcon mime={file.mime} className="size-8" />
			<div className="flex min-w-0 flex-1 flex-wrap gap-1 self-stretch font-medium">
				<div className="flex w-full gap-2">
					<p
						title={file.name}
						className="overflow-x-scroll text-sm font-medium text-ellipsis whitespace-nowrap"
						style={{ scrollbarWidth: "none" }}
					>
						{file.name}
					</p>
					<span className="ml-auto text-sm whitespace-nowrap text-neutral-500">
						{formatFileSize(file.size)}
					</span>
				</div>
				{transfer ? (
					<div className="flex w-full items-center gap-2 text-sm">
						{transfer.status === "active" || transfer.status === "waiting" ? (
							<>
								<Progress value={transfer.progress} max={100} />
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
				) : null}
			</div>
		</li>
	);
}
