import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { toTitleCase } from "#/lib/helper";
import { $connectionState, $identity } from "#/stores/signaling";
import { $peers } from "#/stores/peer";
import { useSession } from "#/hooks/use-session";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import {
	DeviceIcon,
	IconArrowLeft,
	IconLink,
	IconShare,
} from "#/components/icons";
import { Sender } from "#/components/sender";
import { Receiver } from "#/components/receiver";

export const Route = createFileRoute("/s/$id")({
	component: Component,
});

function Component() {
	const { id } = Route.useParams();
	const connectionState = useStore($connectionState);
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
	if (connectionState === "connecting" || !session || !identity) {
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
			text: `Join my room ${session.id} on WebSend to share files`,
			url: sessionURL,
		});
	}

	const users = Object.values(peers);

	if (connectionState !== "open") {
		return "Failed to connect";
	}

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
					<span className="font-semibold text-muted-foreground">Room:</span>
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
			<Main className="max-w-screen-sm">
				<div className="mb-6 flex gap-3">
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
					<div className="mb-4 flex flex-col gap-2">
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
									<p>
										{u.display_name}{" "}
										<span className="max-sm:hidden">({u.device_name})</span>
									</p>
									<span className="ml-auto text-sm font-medium text-muted-foreground">
										{u.connectionState}
									</span>
								</li>
							))}
						</ul>
					</div>

					{identity.id === session.host ? (
						<Sender />
					) : (
						<Receiver session={session} peers={peers} />
					)}
				</div>
			</Main>
		</>
	);
}
