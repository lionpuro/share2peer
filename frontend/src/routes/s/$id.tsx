import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { cn, toTitleCase } from "#/lib/helper";
import { $connectionState, $identity } from "#/stores/signaling";
import { $peers } from "#/stores/peer";
import { useJoinRoom, useRoom } from "#/hooks/use-room";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import {
	DeviceIcon,
	IconArrowLeft,
	IconLink,
	IconShare,
	IconWifi,
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
	const { room } = useRoom();
	const { error } = useJoinRoom(id);
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
	if (connectionState === "connecting" || !room || !identity) {
		return <Loader />;
	}

	const roomURL = `${window.location.protocol}//${window.location.host}/s/${room.id}`;
	function handleCopy() {
		if (!room) return;
		setCopied(true);
		navigator.clipboard.writeText(roomURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}

	function handleShare() {
		if (typeof navigator.share !== "function") return;
		if (!room) return;
		navigator.share({
			title: "Share files",
			text: `Join my room ${room.id} on WebSend to share files`,
			url: roomURL,
		});
	}

	const users = Object.values(peers);

	if (connectionState !== "connected") {
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
					<span className="font-bold">{room.id}</span>
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
						value={roomURL}
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
				<div className="flex flex-col gap-10">
					<div className="flex flex-col gap-2">
						<ul>
							<li key={identity.id} className="flex items-center gap-2">
								<DeviceIcon
									deviceType={identity.device_type}
									width={16}
									height={16}
								/>
								<p>{identity.display_name}</p>
								<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
									ME
								</span>
							</li>
							{users.map((u) => (
								<li key={u.id} className="flex items-center gap-2">
									<DeviceIcon
										deviceType={u.device_type}
										width={16}
										height={16}
									/>
									<p>{u.display_name}</p>
									<span
										title={u.connectionState}
										className={cn(
											"ml-auto cursor-pointer text-sm text-muted-foreground",
											{
												"text-green-600/80": u.connectionState === "connected",
												"text-yellow-600/80":
													u.connectionState === "connecting",
												"text-red-600/80": u.connectionState === "failed",
											},
										)}
									>
										<IconWifi />
									</span>
								</li>
							))}
						</ul>
					</div>
					<Sender />
					<Receiver peers={peers} />
				</div>
			</Main>
		</>
	);
}
