import { useState, type HTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import type { Session } from "#/lib/session";
import { useUpload } from "#/hooks/use-upload";
import { $identity } from "#/lib/socket";
import { $peer } from "#/lib/webrtc";
import type { FileMetadata } from "#/lib/file";
import { calcProgress, cn, formatFileSize, toTitleCase } from "#/lib/helper";
import {
	DeviceIcon,
	FileIcon,
	IconCheck,
	IconDownload,
	IconLink,
	IconX,
} from "#/components/icons";
import { useTransfer } from "#/hooks/use-transfer";
import type { TransferState } from "#/lib/webrtc/transfer";
import { FileInput } from "#/components/ui/file-input";
import { Box } from "#/components/ui/box";
import { Button } from "#/components/ui/button";
import { H2 } from "#/components/ui/heading";
import type { Client } from "#/lib/client";

type Props = {
	session: Session;
};

export function SessionView({ session }: Props) {
	const identity = useStore($identity);
	const peer = useStore($peer);

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4">
			<SessionInfo session={session} />
			<Box>
				{peer ? (
					<ClientInfo client={peer} connected={true} />
				) : session.clients?.length === 2 ? (
					session.clients.map(
						(c) =>
							c.id !== identity?.id && (
								<ClientInfo
									key={"client" + c.id}
									client={c}
									connected={false}
								/>
							),
					)
				) : (
					"Waiting for a peer to join"
				)}
			</Box>
			<FileArea />
		</div>
	);
}

function ClientInfo({
	client,
	connected,
	...props
}: { client: Client; connected: boolean } & HTMLAttributes<HTMLDivElement>) {
	return (
		<div {...props} className="flex flex-wrap items-center gap-1 rounded-md">
			<span className="font-medium">{client.display_name}</span>
			<span className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-400/90 px-2.5 py-0.75 text-sm font-medium text-muted-foreground text-white">
				<DeviceIcon deviceType={client.device_type} size={12} />
				{client.device_name}
			</span>
			<span
				className={cn(
					"flex w-full items-center text-sm font-medium text-muted-foreground before:mr-1 before:content-['●']",
					connected ? "before:text-green-600/90" : "before:text-yellow-600/90",
				)}
			>
				{connected ? "Connected" : "Connecting"}
			</span>
		</div>
	);
}

function SessionInfo({ session }: { session: Session }) {
	const sessionURL = `${window.location.protocol}//${window.location.host}?s=${session.id}`;
	const [copied, setCopied] = useState(false);
	function handleCopy() {
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}
	const identity = useStore($identity);

	return (
		<Box>
			<div className="flex flex-wrap items-center gap-3">
				{identity && (
					<p className="text-sm font-medium">
						<span className="mr-1 font-semibold text-muted-foreground">
							Username:
						</span>
						{identity.display_name}
					</p>
				)}
				<div className="flex w-full items-center gap-1">
					<span className="text-sm font-semibold text-muted-foreground">
						Session:
					</span>
					<span className="rounded-md bg-secondary/70 px-1.5 py-0.5 font-bold">
						{session.id}
					</span>
					<Link
						to="/"
						className="ml-auto flex w-fit items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive-darker"
					>
						Leave
					</Link>
				</div>
				<div className="flex w-full gap-2">
					<input
						readOnly={true}
						value={sessionURL}
						className="flex-1 overflow-x-scroll rounded-lg border border-secondary px-2 py-1.5 text-sm font-medium text-neutral-600 outline-none"
					/>
					<button
						disabled={copied}
						onClick={handleCopy}
						className="ml-auto flex min-w-28 items-center justify-start gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-darker"
					>
						{copied ? (
							<>
								<IconCheck size={20} /> Copied
							</>
						) : (
							<>
								<IconLink size={16} />
								Copy link
							</>
						)}
					</button>
				</div>
			</div>
		</Box>
	);
}

function FileArea() {
	const peer = useStore($peer);
	const { transfers, stopTransfers, startDownload } = useTransfer();
	const { uploads, setUploads, shareUploads, cancelUploads } = useUpload();
	const handleDrop = (files: File[]) => {
		setUploads(files);
		shareUploads();
	};

	const tr = Object.values(transfers);
	return (
		<Box>
			{peer && peer.files.length > 0 ? (
				<>
					<H2 className="mb-2">Files</H2>
					<FileList files={peer.files} transfers={transfers} />
					{tr.length === 0 && (
						<Button
							variant="primary"
							size="sm"
							className="mt-6 gap-1.5"
							onClick={startDownload}
						>
							<IconDownload size={18} />
							Start download
						</Button>
					)}
				</>
			) : uploads.length > 0 ? (
				<>
					<H2 className="mb-2">Uploads</H2>
					<FileList
						files={uploads.map((u) => ({
							id: u.id,
							name: u.file.name,
							mime: u.file.type,
							size: u.file.size,
						}))}
						transfers={transfers}
					/>
					<Button
						variant="secondary"
						size="sm"
						className="mt-6 gap-1.5"
						onClick={cancelUploads}
					>
						<IconX size={18} />
						Cancel upload
					</Button>
				</>
			) : (
				<>
					<H2 className="mb-3">Share files</H2>
					<FileInput
						className="rounded-xl"
						multiple={true}
						onFileInput={(files) => handleDrop(files)}
					/>
				</>
			)}
			{peer && peer.files.length > 0 && tr.length > 0 ? (
				tr.some((t) => t.status !== "complete") ? (
					<Button
						variant="secondary"
						size="sm"
						className="mt-6 gap-1.5"
						onClick={stopTransfers}
					>
						<IconX size={18} />
						Cancel transfer
					</Button>
				) : (
					<p>Transfer complete!</p>
				)
			) : null}
		</Box>
	);
}

type FileListProps = {
	files: FileMetadata[];
	transfers: TransferState;
};

function FileList({ files, transfers }: FileListProps) {
	return (
		<div className="flex flex-col">
			{files.map((file) => {
				const t = transfers[file.id];
				return (
					<div key={file.id} className="flex min-h-16 items-center gap-2">
						<FileIcon mime={file.mime} size={36} />
						<div className="flex flex-1 flex-wrap items-start gap-2 self-stretch py-2 font-medium">
							<p className="text-sm font-medium">{file.name}</p>
							<span className="ml-auto text-sm text-neutral-500">
								{formatFileSize(file.size)}
							</span>
							{t ? (
								<div className="flex w-full items-center gap-2 text-sm">
									{t.status === "sending" ||
									t.status === "receiving" ||
									t.status === "waiting" ? (
										<>
											<progress
												value={calcProgress(t.transferredBytes, t.file.size)}
												max={100}
												className="progress h-2 flex-1"
											></progress>
											<span className="font-medium text-muted-foreground">
												{calcProgress(t.transferredBytes, t.file.size)}%
											</span>
										</>
									) : (
										<p className="ml-auto text-muted-foreground">
											{toTitleCase(t.status)}
										</p>
									)}
								</div>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}
