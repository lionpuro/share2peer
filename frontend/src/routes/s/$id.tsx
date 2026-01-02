import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import { ErrorComponent } from "#/components/error";
import { Main } from "#/components/ui/main";
import { useSession } from "#/hooks/use-session";
import { toTitleCase } from "#/lib/helper";
import { $peer } from "#/lib/webrtc";
import { useTransfer } from "#/hooks/use-transfer";
import { Box } from "#/components/ui/box";
import { FileList, FileListItem } from "#/components/file-list";
import { H2 } from "#/components/ui/heading";
import { Button } from "#/components/ui/button";
import { IconDownload, IconX } from "#/components/icons";
import { Loader } from "#/components/ui/loader";

export const Route = createFileRoute("/s/$id")({
	component: Component,
});

function Component() {
	const { id } = Route.useParams();
	const { session, error, leaveSession } = useSession(id);
	const peer = useStore($peer);
	const { transfers, stopTransfers, startDownload } = useTransfer();

	const tr = Object.values(transfers);

	useEffect(() => {
		return () => {
			if (session) {
				leaveSession(session.id);
			}
		};
	}, [session, leaveSession]);

	if (error) {
		return (
			<ErrorComponent error={toTitleCase(error.message)}>
				<Link
					to="/"
					className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-darker"
				>
					Back
				</Link>
			</ErrorComponent>
		);
	}
	if (!session || !peer) {
		return <Loader />;
	}
	return (
		<Main>
			<Box className="mx-auto w-full max-w-md gap-4">
				<div className="flex w-full items-center gap-2">
					<span className="font-semibold text-muted-foreground">Session:</span>
					<span className="font-bold">{session.id}</span>
				</div>
				{peer.files.length > 0 ? (
					<>
						<H2>Files</H2>
						<FileList>
							{peer.files.map((f) => (
								<FileListItem key={f.id} file={f} transfer={transfers[f.id]} />
							))}
						</FileList>
						{tr.length === 0 && (
							<Button
								variant="primary"
								size="sm"
								className="mt-2 gap-1.5"
								onClick={startDownload}
							>
								<IconDownload />
								Download
							</Button>
						)}
					</>
				) : (
					"Waiting for a peer to share files"
				)}
				{peer.files.length > 0 && tr.length > 0 ? (
					tr.some((t) => t.status !== "complete") ? (
						<Button
							variant="secondary"
							size="sm"
							className="mt-2 gap-1.5"
							onClick={stopTransfers}
						>
							<IconX />
							Cancel transfer
						</Button>
					) : (
						<p>Transfer complete!</p>
					)
				) : null}
			</Box>
		</Main>
	);
}
