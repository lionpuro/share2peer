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
	IconExit,
	IconLink,
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
		<div className="flex flex-col gap-8">
			<SessionInfo session={session} leave={handleLeave} />
			<div className="flex flex-col">
				{(session.clients?.length ?? 1) < 2 || !peer
					? "Waiting for a peer to join"
					: null}
				{(session.clients?.length ?? 1) > 1 && (
					<div className="mx-auto flex w-full flex-col items-center">
						<h2 className="mb-2 hidden text-xl font-bold">Connected clients</h2>
						<div className="flex flex-wrap justify-center">
							{session.clients &&
								session.clients
									.filter((c) => c.id !== identity?.id)
									.map((c) => (
										<div
											key={"client" + c.id}
											className="flex flex-col items-center gap-1 p-2 text-sm"
										>
											<span className="rounded-full bg-primary p-3 text-white">
												<DeviceIcon
													deviceType={c.device_type}
													className="size-6 sm:size-8"
												/>
											</span>
											{c.device_name}
										</div>
									))}
						</div>
					</div>
				)}
			</div>
			{peer && peer.files.length > 0 ? (
				<div className="flex flex-col">
					<h2 className="mb-4 text-xl font-bold">Files</h2>
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
							className="mt-8 flex items-center justify-center gap-1.5 rounded-md bg-secondary py-2 text-sm font-medium hover:bg-secondary-darker/80"
							onClick={download.cancel}
						>
							<IconX size={18} />
							Cancel download
						</button>
					) : (
						<button
							className="mt-8 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-darker disabled:bg-muted disabled:text-muted-foreground"
							onClick={download.start}
						>
							<IconDownload size={18} />
							Start download
						</button>
					)}
				</div>
			) : uploads.length > 0 ? (
				<div className="flex flex-col">
					<h2 className="mb-4 text-xl font-bold">Uploads</h2>
					<FileList
						files={uploads.map((u) => ({
							id: u.id,
							name: u.file.name,
							mime: u.file.type,
							size: u.file.size,
						}))}
					/>
					<button
						className="mt-8 flex items-center justify-center gap-1.5 rounded-md bg-secondary py-2 text-sm font-medium hover:bg-secondary-darker/80"
						onClick={cancelShare}
					>
						<IconX size={18} />
						Cancel upload
					</button>
				</div>
			) : (
				<div className="mt-4">
					<FileInput
						className="rounded-xl bg-background/50"
						multiple={true}
						labelText="Upload files"
						onFileInput={(files) => uploadFiles(files)}
					/>
				</div>
			)}
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
		<div className="flex w-full flex-col gap-4 rounded-lg border border-secondary p-4">
			<div className="flex items-center">
				<div className="flex items-center gap-1">
					Session:
					<span className="rounded-lg bg-secondary/50 px-3 py-1.5 font-mono font-semibold">
						{session.id}
					</span>
				</div>
				<button
					disabled={copied}
					onClick={handleCopy}
					className="ml-auto flex min-h-9 min-w-28 items-center justify-start gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-darker"
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
			<button
				onClick={() => leave(session.id)}
				className="flex w-fit items-center justify-center gap-1.5 rounded-lg bg-destructive py-2 pr-4 pl-3 text-sm font-medium text-white hover:bg-destructive-darker"
			>
				<IconExit size={16} />
				Leave
			</button>
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
