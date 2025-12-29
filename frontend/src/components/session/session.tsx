import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import type { Session } from "#/lib/session";
import { useSession } from "#/hooks/use-session";
import { useUpload } from "#/hooks/use-upload";
import { $identity } from "#/lib/socket";
import { $peer } from "#/lib/webrtc";
import type { FileMetadata } from "#/lib/file";
import { calcProgress, formatFileSize } from "#/lib/helper";
import { FileInput } from "#/components/file-input";
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
import { Button } from "#/components/ui/button";

type Props = {
	session: Session;
};

export function SessionView({ session }: Props) {
	const identity = useStore($identity);
	const peer = useStore($peer);

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4">
			<SessionInfo session={session} />
			<div className="flex flex-col rounded-xl border border-secondary p-4">
				{session.clients && session.clients.length > 1 ? (
					<>
						<h2 className="mb-3 text-lg font-bold">Peers</h2>
						<div className="flex flex-col gap-4">
							{session.clients
								.filter((c) => c.id !== identity?.id)
								.map((c) => (
									<div
										key={"client" + c.id}
										className="flex flex-wrap items-center gap-1 rounded-md bg-secondary/50 px-2 py-1"
									>
										<span className="font-medium">{c.display_name}</span>
										<span className="ml-3 flex items-center gap-1 text-sm font-medium text-muted-foreground">
											<DeviceIcon
												deviceType={c.device_type}
												className="text-muted-foreground/80"
												size={12}
											/>
											{c.device_name}
										</span>
										<span
											className={`before:mr-1 before:content-['●'] ${c.id === peer?.id ? "before:text-green-600/90" : "before:text-yellow-600/90"} flex w-full items-center text-sm font-medium text-muted-foreground`}
										>
											{c.id === peer?.id ? "Connected" : "Connecting"}
										</span>
									</div>
								))}
						</div>
					</>
				) : (
					"Waiting for a peer to join"
				)}
			</div>
			<FileArea />
		</div>
	);
}

function SessionInfo({ session }: { session: Session }) {
	const navigate = useNavigate();
	const { leaveSession } = useSession();

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

	function handleLeave() {
		leaveSession(session.id);
		navigate({ to: "/" });
	}

	return (
		<div className="flex w-full flex-col gap-4 rounded-xl border border-secondary p-4">
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex w-full items-center gap-1">
					<span className="text-sm font-semibold text-muted-foreground">
						Session:
					</span>
					<span className="rounded-md bg-secondary/70 px-1.5 py-0.5 font-bold">
						{session.id}
					</span>
					<button
						onClick={handleLeave}
						className="ml-auto flex w-fit items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive-darker"
					>
						Leave
					</button>
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
				{identity && (
					<p className="text-sm font-medium">
						<span className="mr-1 font-semibold text-muted-foreground">
							Username:
						</span>
						{identity.display_name}
					</p>
				)}
			</div>
		</div>
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
		<div className="flex flex-col rounded-xl border border-secondary p-4">
			{peer && peer.files.length > 0 ? (
				<>
					<h2 className="mb-2 text-lg font-bold">Files</h2>
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
					<h2 className="mb-2 text-lg font-bold">Uploads</h2>
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
					<h2 className="mb-3 text-lg font-bold">Share files</h2>
					<FileInput
						className="rounded-xl bg-card/40"
						multiple={true}
						labelText="Upload files"
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
		</div>
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
											{t.status.charAt(0).toUpperCase() + t.status.slice(1)}
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
