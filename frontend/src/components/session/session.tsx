import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "#/lib/session";
import { useSession } from "#/hooks/use-session";
import { useUpload } from "#/hooks/use-upload";
import { useStore } from "@nanostores/react";
import { $identity } from "#/lib/socket";
import { useDownload } from "#/hooks/use-download";
import { $peer } from "#/lib/webrtc";
import type { FileMetadata } from "#/lib/file";
import { formatFileSize } from "#/lib/helper";
import { FileInput } from "#/components/file-input";
import {
	DeviceIcon,
	FileIcon,
	IconCheck,
	IconDownload,
	IconLink,
	IconSignal,
	IconX,
} from "#/components/icons";

type Props = {
	session: Session;
};

export function SessionView({ session }: Props) {
	const { leaveSession } = useSession();
	const navigate = useNavigate();
	const identity = useStore($identity);
	const peer = useStore($peer);
	const { uploads, uploadFiles, cancelShare } = useUpload();
	const download = useDownload();

	function handleLeave() {
		if (!session) return;
		cancelShare();
		leaveSession(session.id);
		navigate({ to: "/" });
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4">
			<SessionInfo session={session} leave={handleLeave} />
			<div className="flex flex-col rounded-xl border border-secondary p-4">
				{session.clients && session.clients.length > 1 ? (
					<>
						<h2 className="mb-3 font-bold">Peers</h2>
						<div className="flex flex-col gap-4">
							{session.clients
								.filter((c) => c.id !== identity?.id)
								.map((c) => (
									<div key={"client" + c.id} className="flex flex-wrap gap-2">
										<div className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-1.5 py-0.5 text-sm font-medium">
											<span className="rounded-full p-1">
												<DeviceIcon
													deviceType={c.device_type}
													className="text-muted-foreground/80"
													size={16}
												/>
											</span>
											{c.device_name}
											<span className="ml-auto flex items-center gap-1 text-sm text-neutral-600">
												{c.id === peer?.id ? "Connected" : "Connecting"}
												<IconSignal
													size={18}
													className={
														c.id === peer?.id
															? "text-green-600/90"
															: "text-yellow-600/90"
													}
												/>
											</span>
										</div>
									</div>
								))}
						</div>
					</>
				) : (
					"Waiting for a peer to join"
				)}
			</div>
			<div className="flex flex-col rounded-xl border border-secondary p-4">
				{peer && peer.files.length > 0 ? (
					<>
						<h2 className="mb-2 font-bold">Files</h2>
						<FileList files={peer.files} />
						{download.status && (
							<span
								className={`${download.status === "downloading" ? "mt-4" : "mt-6"} mb-2 text-center text-sm`}
							>
								{download.status === "downloading"
									? `Transferring file ${download.downloadedFiles + 1} / ${download.totalFiles}`
									: "Download complete!"}
							</span>
						)}
						{download.status === "downloading" && (
							<>
								<progress
									value={download.progress}
									max={100}
									className="progress h-2"
								></progress>
							</>
						)}
						{download.totalFiles > 0 &&
						download.downloadedFiles ===
							download.totalFiles ? null : download.status === "downloading" ? (
							<button
								className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-medium hover:bg-secondary-darker/80"
								onClick={download.cancel}
							>
								<IconX size={18} />
								Cancel download
							</button>
						) : (
							<button
								className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary-darker disabled:bg-muted disabled:text-muted-foreground"
								onClick={download.start}
							>
								<IconDownload size={18} />
								Start download
							</button>
						)}
					</>
				) : uploads.length > 0 ? (
					<div className="flex flex-col">
						<h2 className="mb-3 font-bold">Uploads</h2>
						<FileList
							files={uploads.map((u) => ({
								id: u.id,
								name: u.file.name,
								mime: u.file.type,
								size: u.file.size,
							}))}
						/>
						<button
							className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-medium hover:bg-secondary-darker/80"
							onClick={cancelShare}
						>
							<IconX size={18} />
							Cancel upload
						</button>
					</div>
				) : (
					<>
						<h2 className="mb-3 font-bold">Share files</h2>
						<FileInput
							className="rounded-xl bg-card/40"
							multiple={true}
							labelText="Upload files"
							onFileInput={(files) => uploadFiles(files)}
						/>
					</>
				)}
			</div>
		</div>
	);
}

function SessionInfo({
	session,
	leave,
}: {
	session: Session;
	leave: (id: string) => void;
}) {
	const sessionURL = `${window.location.protocol}//${window.location.host}?s=${session.id}`;
	const [copied, setCopied] = useState(false);
	function handleCopy() {
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
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
						onClick={() => leave(session.id)}
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
			</div>
		</div>
	);
}

type FileListProps = {
	files: FileMetadata[];
};

function FileList({ files }: FileListProps) {
	return (
		<div className="flex flex-col">
			{files.map((file) => (
				<div key={file.id} className="flex items-center gap-2 py-2 font-medium">
					<FileIcon mime={file.mime} />
					<p className="text-sm font-medium">{file.name}</p>
					<span className="ml-auto text-sm text-neutral-500">
						{formatFileSize(file.size)}
					</span>
				</div>
			))}
		</div>
	);
}
