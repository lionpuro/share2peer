import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { toTitleCase } from "#/lib/helper";
import { createFileMetadata } from "#/lib/file";
import { $peers, type PeerState } from "#/stores/peer";
import { useSession } from "#/hooks/use-session";
import { useUploads, useDownloads } from "#/hooks/transfer";
import { Main } from "#/components/ui/main";
import { Heading } from "#/components/ui/heading";
import { Button } from "#/components/ui/button";
import { ErrorComponent } from "#/components/error";
import { FileList, FileListItem } from "#/components/file-list";
import {
	DeviceIcon,
	IconArrowLeft,
	IconDownload,
	IconLink,
	IconShare,
	IconUpload,
	IconX,
} from "#/components/icons";
import { Loader } from "#/components/ui/loader";
import { FileInput } from "#/components/ui/file-input";
import { $identity } from "#/stores/signaling";
import type { Session } from "#/lib/schemas";
import { Progress } from "#/components/ui/progress";

export const Route = createFileRoute("/s/$id")({
	component: Component,
});

function Component() {
	const { id } = Route.useParams();
	const identity = useStore($identity);
	const { session, error } = useSession(id);
	const peers = useStore($peers);

	const [copied, setCopied] = useState(false);

	if (error) {
		return (
			<ErrorComponent error={toTitleCase(error)}>
				<Link
					to="/"
					className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-darker"
				>
					Back
				</Link>
			</ErrorComponent>
		);
	}
	if (!session || !identity) {
		return <Loader />;
	}

	const sessionURL = `${window.location.protocol}//${window.location.host}/s/${session.id}`;
	function handleCopy() {
		if (!session) return;
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}

	function handleShare() {
		if (typeof navigator.share !== "function") return;
		if (!session) return;
		navigator.share({
			title: "Share files",
			text: `Join my session ${session.id} on WebSend to share files`,
			url: sessionURL,
		});
	}

	const users = Object.values(peers);

	return (
		<>
			<div className="mx-auto grid w-full max-w-screen-xl grid-cols-[1fr_auto_1fr] grid-rows-1 px-4 sm:px-6">
				<div className="flex">
					<Link
						to="/"
						title="Leave"
						className="p-2 text-muted-foreground/70 hover:text-muted-foreground"
					>
						<IconArrowLeft width={24} height={24} />
					</Link>
				</div>
				<div className="flex items-center gap-2">
					<span className="font-semibold text-muted-foreground">Session:</span>
					<span className="font-bold">{session.id}</span>
				</div>
				<div className="flex">
					{typeof navigator.share === "function" && (
						<button
							onClick={handleShare}
							className="ml-auto p-2 text-lg text-muted-foreground/70 hover:text-muted-foreground"
						>
							<IconShare />
						</button>
					)}
				</div>
			</div>
			<Main>
				<div className="mb-6 flex gap-3 sm:mb-8">
					<input
						readOnly={true}
						value={sessionURL}
						className="flex-1 overflow-x-scroll rounded-lg border border-secondary px-3 py-1.5 text-sm font-medium text-neutral-600 outline-none"
					/>
					<Button
						disabled={copied}
						onClick={handleCopy}
						variant="secondary"
						title="Copy link"
						className="gap-1.5 pl-3"
					>
						<IconLink />
						Copy
					</Button>
				</div>
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<Heading order={2} size="sm">
							Users
						</Heading>
						<ul>
							<li key={identity.id} className="flex items-center gap-2">
								<DeviceIcon
									deviceType={identity.device_type}
									width={16}
									height={16}
								/>
								<p>{identity.display_name + " (me)"}</p>
							</li>
							{users.map((u) => (
								<li key={u.id} className="flex items-center gap-2">
									<DeviceIcon
										deviceType={u.device_type}
										width={16}
										height={16}
									/>
									<p>{u.display_name}</p>
									<span className="ml-auto text-sm font-medium text-muted-foreground">
										{u.connectionState}
									</span>
								</li>
							))}
						</ul>
					</div>

					{identity.id === session.host ? (
						<UploadView />
					) : (
						<DownloadView session={session} peers={peers} />
					)}
				</div>
			</Main>
		</>
	);
}

function UploadView() {
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
					<Heading order={2} size="sm" className="mt-8">
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

function DownloadView({
	session,
	peers,
}: {
	session: Session;
	peers: Record<string, PeerState>;
}) {
	const { files, downloads, transfersByFile, stop, start, transferring } =
		useDownloads();
	const host = session.host ? peers[session.host] : undefined;
	const loading = !host || host.files === undefined;

	if (loading) {
		return null;
	}
	return (
		<div className="flex flex-col gap-4">
			{files.length === 0 ? (
				<span className="mt-4 text-center text-muted-foreground">
					Waiting for a peer to share files
				</span>
			) : (
				<>
					<Heading order={2} size="sm">
						Files
					</Heading>
					<FileList>
						{files.map((f) => (
							<FileListItem
								key={"file" + f.id}
								file={f}
								transfer={transfersByFile[f.id]?.[0]}
							/>
						))}
					</FileList>
					{downloads.length === 0 ? (
						<Button
							variant="primary"
							size="sm"
							className="mt-2 gap-1.5 sm:ml-auto sm:pl-3"
							onClick={start}
						>
							<IconDownload />
							Download ({files.length})
						</Button>
					) : transferring ? (
						<Button
							variant="secondary"
							size="sm"
							className="mt-2 gap-1.5 sm:ml-auto sm:pl-3"
							onClick={stop}
						>
							<IconX />
							Cancel download
						</Button>
					) : null}
				</>
			)}
		</div>
	);
}
