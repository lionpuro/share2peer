import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Main } from "#/components/ui/main";
import { useSocket } from "#/hooks/use-socket";
import { useSession } from "#/hooks/use-session";
import { Loader } from "#/components/ui/loader";
import { IconAlert, IconCheck, IconCopy, IconX } from "#/components/icons";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { FileInput } from "#/components/ui/file-input";
import { useUpload } from "#/hooks/use-upload";
import { Box } from "#/components/ui/box";
import { FileList, FileListItem } from "#/components/file-list";
import type { Session } from "#/lib/session";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const [joinCode, setJoinCode] = useState("");
	const { session, requestSession, leaveSession } = useSession();
	const { connectionState } = useSocket();
	const { uploads, setUploads, cancelUploads, shareUploads } = useUpload();

	const handleDrop = (files: File[]) => {
		setUploads(files);
		if (session) {
			shareUploads();
		}
	};

	const handleShare = () => {
		requestSession();
	};

	if (connectionState !== "open" && connectionState !== "error") {
		return <Loader />;
	}
	if (connectionState === "error") {
		return (
			<Main>
				<p className="text-center">Connection error</p>
			</Main>
		);
	}

	return (
		<Main>
			{session ? (
				<Box className="mx-auto w-full max-w-md gap-4">
					<SessionInfo session={session} />
					<p className="text-sm font-medium text-muted-foreground">
						Share the link or enter the session code on another device
					</p>
					<span className="mb-2 flex items-center gap-1 text-sm">
						<IconAlert className="text-yellow-500" />
						<span className="font-bold">Note:</span>
						Keep this page open during transfer!
					</span>
					<Heading order={2}>Files</Heading>
					{uploads.length > 0 ? (
						<>
							<FileList>
								{uploads.map((f) => (
									<FileListItem key={f.id} file={f} />
								))}
							</FileList>
							<Button
								variant="secondary"
								onClick={cancelUploads}
								className="mt-2 gap-1"
							>
								<IconX />
								Cancel
							</Button>
						</>
					) : (
						<>
							<FileInput
								className="rounded-xl"
								multiple={true}
								labelText="Click to browse or drop files here"
								onFileInput={(files) => handleDrop(files)}
							/>
							<Button
								variant="primary"
								onClick={() => leaveSession(session.id)}
								className="mt-2 gap-1 bg-red-600/90 hover:bg-red-700/90"
							>
								Close session
							</Button>
						</>
					)}
				</Box>
			) : (
				<div className="mx-auto flex w-full max-w-xs flex-col">
					<Heading order={2} className="mb-4">
						Share files
					</Heading>
					{uploads.length === 0 ? (
						<FileInput
							className="rounded-xl"
							multiple={true}
							labelText="Click to browse or drop files here"
							onFileInput={(files) => handleDrop(files)}
						/>
					) : (
						<>
							<FileList>
								{uploads.map((f) => (
									<FileListItem key={f.id} file={f} />
								))}
							</FileList>
							<div className="mt-4 flex gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setUploads([])}
									className="basis-1/2"
									disabled={uploads.length === 0}
								>
									Remove
								</Button>
								<Button
									variant="primary"
									size="sm"
									onClick={handleShare}
									className="basis-1/2"
									disabled={uploads.length === 0}
								>
									Share
								</Button>
							</div>
						</>
					)}
					<div className="my-6 flex items-center gap-2">
						<hr className="h-0.5 flex-1 rounded-xs border-none bg-secondary" />
						<span className="text-sm font-medium text-neutral-500">OR</span>
						<hr className="h-0.5 flex-1 rounded-xs border-none bg-secondary" />
					</div>
					<Heading order={2} className="mb-4">
						Join session
					</Heading>
					<div className="relative flex">
						<input
							id="input-code"
							placeholder="ABC123"
							minLength={6}
							maxLength={6}
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							className="mb-4 flex-1 rounded-lg border border-secondary px-2 py-1.25 font-mono placeholder:text-neutral-400"
						/>
						{joinCode.length > 0 && (
							<button
								onClick={() => setJoinCode("")}
								className="absolute right-0 p-2"
							>
								<IconX className="text-muted-foreground hover:text-foreground" />
							</button>
						)}
					</div>
					<Link
						to="/s/$id"
						params={{ id: joinCode }}
						className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${joinCode.length !== 6 ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary-darker"}`}
						disabled={joinCode.length !== 6}
					>
						Join
					</Link>
				</div>
			)}
		</Main>
	);
}

function SessionInfo({ session }: { session: Session }) {
	const sessionURL = `${window.location.protocol}//${window.location.host}/s/${session.id}`;
	const [copied, setCopied] = useState(false);
	function handleCopy() {
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<div className="flex w-full items-center gap-2">
				<span className="font-semibold text-muted-foreground">Session:</span>
				<span className="font-bold">{session.id}</span>
			</div>
			<div className="flex flex-1 gap-2">
				<input
					readOnly={true}
					value={sessionURL}
					className="flex-1 overflow-x-scroll rounded-lg border border-secondary px-2 py-1.5 text-sm font-medium text-neutral-600 outline-none"
				/>
				<button
					disabled={copied}
					onClick={handleCopy}
					title="Copy link"
					className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary-darker"
				>
					{copied ? <IconCheck /> : <IconCopy />}
				</button>
			</div>
		</div>
	);
}
