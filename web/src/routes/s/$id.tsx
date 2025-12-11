import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../lib/socket";
import { type MessageEventListener } from "../../lib/message";
import { Loader } from "../../components/loader";
import {
	IconCheck,
	IconCopy,
	IconDownload,
	IconExit,
	IconFileAudio,
	IconFileDefault,
	IconFileImage,
	IconFileVideo,
	IconX,
} from "../../icons";
import { Main } from "../../components/main";
import { useSession } from "../../lib/session";
import { $peer } from "../../lib/webrtc";
import { useStore } from "@nanostores/react";
import { FileInput } from "../../components/file-input";
import { useDownload, useUpload, type FileMetadata } from "../../lib/file";
import { formatFileSize } from "../../lib/helper";

export const Route = createFileRoute("/s/$id")({
	component: Component,
});

function Component() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { session, joinSession, leaveSession } = useSession();
	const sessionURL = `${window.location.protocol}//${window.location.host}/s/${id}`;
	const [copied, setCopied] = useState(false);
	const { socket, connected } = useSocket();
	const { uploads, uploadFiles, removeUploads } = useUpload();
	const download = useDownload();

	const handleCancel = () => removeUploads();

	const handleDownload = () => {
		download.start();
	};

	const joinedRef = useRef(false);

	const handleJoined: MessageEventListener<"session-joined"> =
		useCallback(() => {
			joinedRef.current = false;
		}, []);

	useEffect(() => {
		if (!connected || session !== null) {
			return;
		}

		socket.addEventListener("session-joined", handleJoined);

		if (!joinedRef.current) {
			joinedRef.current = true;
			joinSession(id);
		}
		return () => {
			socket.removeEventListener("session-joined", handleJoined);
		};
	}, [id, socket, connected, session, joinSession, handleJoined]);

	function handleCopy() {
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}

	function handleLeave() {
		if (!session) return;
		handleCancel();
		leaveSession(session.id);
		navigate({ to: "/" });
	}

	const peer = useStore($peer);

	if (!connected) {
		return <Loader text="Connecting..." />;
	}
	if (!session) {
		return "Session not found";
	}
	return (
		<Main>
			<div className="mx-auto my-auto flex w-full max-w-sm flex-col gap-4 rounded-xl border-2 border-neutral-300/80 p-8">
				{!peer || peer.files.length < 1 ? (
					<div className="flex w-full max-w-sm flex-col items-center gap-4">
						<div className="rounded-lg bg-neutral-200 px-4 py-2 font-mono text-5xl font-semibold">
							{id}
						</div>
						<p className="text-center text-sm">
							Input this share code on another device or join using the link.
						</p>
						<div className="mb-4 flex w-full gap-2">
							<input
								readOnly={true}
								value={sessionURL}
								className="grow rounded-lg border border-neutral-300 px-2 py-1.5 outline-none"
							/>
							<button
								disabled={copied}
								onClick={handleCopy}
								className="flex size-10 items-center justify-center rounded-lg bg-neutral-200 hover:bg-neutral-300/80"
							>
								{copied ? <IconCheck size={22} /> : <IconCopy size={18} />}
							</button>
						</div>
						{(session.clients?.length ?? 1) < 2 || !peer
							? "Waiting for a peer to connect"
							: null}
					</div>
				) : null}
				{peer && peer.files.length > 0 ? (
					<div className="flex flex-col">
						<h2 className="mb-4 text-xl font-bold">Files</h2>
						<FileList files={peer.files} />
						<span
							className={`${download.status === "receiving" ? "mt-4" : "mt-6"} mb-2 text-center text-sm`}
						>
							{download.status === "receiving"
								? `Transferring file ${download.results.length + 1} / ${download.queue.length + download.results.length}`
								: download.results.length > 0
									? "Download complete"
									: "Ready to download files"}
						</span>
						{download.status === "receiving" && (
							<>
								<progress
									value={download.progress}
									max={100}
									className="progress h-2"
								></progress>
							</>
						)}
						<button
							className="mt-8 flex items-center justify-center gap-1.5 rounded-md bg-blue-700/70 py-2 text-sm font-medium text-white hover:bg-blue-800/75 disabled:bg-neutral-200 disabled:text-neutral-500"
							onClick={handleDownload}
							disabled={download.status === "receiving"}
						>
							<IconDownload size={18} />
							Start download
						</button>
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
							className="mt-8 flex items-center justify-center gap-1.5 rounded-md bg-neutral-200 py-2 text-sm font-medium hover:bg-neutral-300/80"
							onClick={handleCancel}
						>
							<IconX size={18} />
							Cancel upload
						</button>
					</div>
				) : (
					<div className="mt-4">
						<FileInput
							className="rounded-xl bg-neutral-200/50"
							multiple={true}
							labelText="Upload files"
							onFileInput={(files) => uploadFiles(files)}
						/>
					</div>
				)}
				<button
					onClick={handleLeave}
					className="flex items-center justify-center gap-1.5 rounded-md bg-red-600/80 py-2 text-sm font-medium text-white hover:bg-red-700/80"
				>
					<IconExit size={18} />
					Leave session
				</button>
			</div>
		</Main>
	);
}

type FileListProps = {
	files: FileMetadata[];
};

function FileIcon({ mime }: { mime: string }) {
	const parts = mime.split("/");
	switch (parts[0]) {
		case "image":
			return <IconFileImage />;
		case "video":
			return <IconFileVideo />;
		case "audio":
			return <IconFileAudio />;
		default:
			return <IconFileDefault />;
	}
}

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
