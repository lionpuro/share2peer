import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { cn, toTitleCase } from "#/lib/helper";
import { $identity } from "#/lib/server";
import { createFileMetadata } from "#/lib/file";
import { $peers, sendCancelShare, shareFiles } from "#/lib/webrtc";
import { useSession } from "#/hooks/use-session";
import { useTransfer } from "#/hooks/use-transfer";
import { useUpload } from "#/hooks/use-upload";
import { Main } from "#/components/ui/main";
import { Heading } from "#/components/ui/heading";
import { Button } from "#/components/ui/button";
import { ErrorComponent } from "#/components/error";
import { FileList, FileListItem } from "#/components/file-list";
import {
	DeviceIcon,
	IconArrowLeft,
	IconCheck,
	IconCopy,
	IconDownload,
	IconUpload,
	IconX,
} from "#/components/icons";
import { Loader } from "#/components/ui/loader";
import { FileInput } from "#/components/ui/file-input";

export const Route = createFileRoute("/s/$id")({
	component: Component,
});

function Component() {
	const { id } = Route.useParams();
	const { session, error } = useSession(id);
	const {
		incoming,
		outgoing,
		stopIncoming,
		stopOutgoing,
		findIncoming,
		startDownload,
	} = useTransfer();
	const incomingFiles = Object.entries(incoming.byTransfer).map(
		([id, progress]) => ({ id, ...progress }),
	);
	const { uploads, setUploads } = useUpload();
	const peers = useStore($peers);
	const identity = useStore($identity);
	const [selectedFiles, setSelectedFiles] = useState<typeof uploads>([]);

	const handleDrop = (files: File[]) => {
		const uploads = files.map((file) => {
			const meta = createFileMetadata(file);
			return { ...meta, file: file };
		});
		setSelectedFiles(uploads);
	};

	const handleStartShare = () => {
		setUploads(selectedFiles);
		if (session && selectedFiles.length > 0) {
			shareFiles(
				selectedFiles.map((u) => ({
					id: u.id,
					name: u.name,
					mime: u.mime,
					size: u.size,
				})),
			);
		}
	};

	const handleStopShare = () => {
		stopOutgoing();
		sendCancelShare();
		setUploads([]);
	};

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

	const sharingPeers = peers.filter((p) => p.files.length > 0);
	const users = [identity, ...peers];
	const peerFiles = peers.flatMap((p) => p.files);

	return (
		<>
			<div className="mx-auto grid w-full max-w-screen-lg grid-cols-[1fr_auto_1fr] grid-rows-1 px-4 sm:px-6">
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
			</div>
			<Main>
				<div className="mx-auto flex w-full max-w-md gap-2 max-sm:mb-4 sm:order-1 sm:mt-auto sm:pt-8">
					<input
						readOnly={true}
						value={sessionURL}
						className="flex-1 overflow-x-scroll rounded-lg border border-secondary px-2 py-1.5 text-sm font-medium text-neutral-600 outline-none"
					/>
					<Button
						disabled={copied}
						onClick={handleCopy}
						variant="secondary"
						title="Copy link"
						className="gap-2 pl-3"
					>
						{copied ? <IconCheck /> : <IconCopy />}
						Copy
					</Button>
				</div>
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<Heading order={2} size="sm">
							Users
						</Heading>
						<ul>
							{users.map((u) => (
								<li key={u.id} className="flex items-center gap-2">
									<DeviceIcon
										deviceType={u.device_type}
										width={16}
										height={16}
									/>
									<p className="">
										{u.display_name + (u.id === identity.id ? " (me)" : "")}
									</p>
								</li>
							))}
						</ul>
					</div>

					{identity.id === session.host ? (
						<div className="flex flex-col gap-4">
							{uploads.length > 0 ? (
								<>
									<Heading order={2} size="sm">
										Shared files
									</Heading>
									<FileList>
										{uploads.map((f) => (
											<FileListItem key={"up" + f.id} file={f} />
										))}
									</FileList>
									<div className="flex gap-2 max-sm:flex-col">
										<span
											className={cn(
												"flex items-center before:mr-1.5 before:text-xs before:content-['●']",
												outgoing.status === "transferring"
													? "text-green-600/90"
													: "text-muted-foreground before:text-neutral-400",
											)}
										>
											{outgoing.status === "transferring"
												? "Transferring"
												: "Waiting for a peer to start download"}
										</span>
										<Button
											variant="secondary"
											size="sm"
											className="max-sm:mt-4 sm:ml-auto"
											onClick={handleStopShare}
										>
											Stop sharing
										</Button>
									</div>
									{outgoing.status === "transferring" ? (
										<div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
											<span className="w-full text-sm font-medium text-muted-foreground">
												Transfer progress
											</span>
											<progress
												value={outgoing.progress}
												max={100}
												className="progress h-2 flex-1"
											></progress>
											<span className="text-sm font-medium text-muted-foreground">
												{outgoing.progress}%
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
											onClick={handleStartShare}
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
					) : (
						<div className="flex flex-col gap-4">
							{peerFiles.length === 0 ? (
								<span className="mt-4 text-center text-muted-foreground">
									Waiting for a peer to share files
								</span>
							) : (
								<>
									<Heading order={2} size="sm">
										Files
									</Heading>
									<FileList>
										{peerFiles.map((f) => (
											<FileListItem
												key={"file" + f.id}
												file={f}
												transfer={findIncoming(f.id)}
											/>
										))}
									</FileList>
									{incomingFiles.length === 0 ? (
										<Button
											variant="primary"
											size="sm"
											className="mt-2 gap-1.5 sm:ml-auto sm:pl-3"
											onClick={() => startDownload(sharingPeers)}
										>
											<IconDownload />
											Download ({peerFiles.length})
										</Button>
									) : incomingFiles.some(
											(t) => t?.status === "transferring",
									  ) ? (
										<Button
											variant="secondary"
											size="sm"
											className="mt-2 gap-1.5 sm:ml-auto sm:pl-3"
											onClick={stopIncoming}
										>
											<IconX />
											Cancel download
										</Button>
									) : null}
								</>
							)}
						</div>
					)}
				</div>
			</Main>
		</>
	);
}
