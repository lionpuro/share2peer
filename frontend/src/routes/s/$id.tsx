import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { cn, toTitleCase } from "#/lib/helper";
import { $connectionState, $identity } from "#/stores/signaling";
import { $peers, type PeerState } from "#/stores/peer";
import { useJoinRoom, useRoom } from "#/hooks/use-room";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import { DeviceIcon, IconCheck, IconCopy, IconShare } from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { Room, User } from "#/lib/schemas";

export const Route = createFileRoute("/s/$id")({
	component: Component,
	head: (ctx) => ({
		meta: [{ title: `Room ${ctx.params.id} | WebSend` }],
	}),
});

function Component() {
	const { id } = Route.useParams();
	const connectionState = useStore($connectionState);
	const identity = useStore($identity);
	const { room } = useRoom();
	const { error } = useJoinRoom(id);
	const peers = useStore($peers);


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

	if (connectionState !== "connected") {
		return "Failed to connect";
	}

	return (
		<Main className="max-w-screen-sm">
			<div className="flex flex-col gap-10">
				<RoomInfo identity={identity} room={room} peers={peers} />
				<FileArea />
			</div>
		</Main>
	);
}

function RoomInfo({
	identity,
	room,
	peers,
}: {
	identity: User;
	room: Room;
	peers: Record<string, PeerState>;
}) {
	const users: PeerState[] =
		room.users
			?.filter((u) => u.id !== identity.id)
			.map((u) => {
				return peers[u.id] || { ...u, connectionState: "disconnected" };
			}) || [];

	const [copiedURL, setCopiedURL] = useState(false);
	const [copiedID, setCopiedID] = useState(false);
	const roomURL = `${window.location.protocol}//${window.location.host}/s/${room.id}`;

	function copyURL() {
		setCopiedURL(true);
		navigator.clipboard.writeText(roomURL);
		setTimeout(() => {
			setCopiedURL(false);
		}, 1000);
	}

	function copyID() {
		setCopiedID(true);
		navigator.clipboard.writeText(room.id);
		setTimeout(() => {
			setCopiedID(false);
		}, 1000);
	}

	function shareURL() {
		if (typeof navigator.share === "function") {
			navigator.share({ url: roomURL });
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center">
				<span className="mr-2 font-bold">Room:</span>
				<p className="overflow-x-scroll font-medium outline-none">{room.id}</p>
				<Button
					disabled={copiedID}
					onClick={copyID}
					variant="ghost"
					title="Copy"
					className="size-8 p-0 text-muted-foreground/75 hover:text-muted-foreground disabled:bg-transparent"
				>
					{!copiedID ? (
						<IconCopy className="text-xs" />
					) : (
						<IconCheck className="text-sm" />
					)}
				</Button>
				{typeof navigator.share === "function" && (
					<Button
						variant="ghost"
						onClick={shareURL}
						className="ml-auto gap-2 max-sm:size-9 max-sm:p-0 max-sm:text-base max-sm:text-neutral-400 sm:border sm:py-1.5 sm:pl-3"
					>
						<IconShare />
						<span className="max-sm:hidden">Share</span>
					</Button>
				)}
			</div>
			<div className="flex flex-wrap gap-2">
				<input
					id="room-url"
					readOnly={true}
					value={roomURL}
					className="flex-1 overflow-x-scroll rounded-lg border px-3 py-1.5 text-sm font-medium text-ellipsis outline-none"
				/>
				<Button
					disabled={copiedURL}
					onClick={copyURL}
					variant="primary"
					title="Copy"
					className="gap-2 max-sm:size-9 max-sm:p-0 sm:py-1.5 sm:pl-3"
				>
					{!copiedURL ? <IconCopy /> : <IconCheck />}
					<span className="max-sm:hidden">Copy</span>
				</Button>
			</div>
			<div className="mt-4 flex flex-col gap-3">
				<Heading order={2} size="sm">
					Users
				</Heading>
				<ul className="flex flex-col gap-2">
					<li key={identity.id} className="flex items-center gap-3">
						<div className="flex h-10 items-center justify-start rounded-lg text-xl text-neutral-400">
							<DeviceIcon
								deviceType={identity.device_type}
								width={24}
								height={24}
							/>
						</div>
						<div className="flex flex-1 flex-col justify-between py-0.5">
							<div className="flex items-center leading-none">
								{identity.display_name}
								<span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
									YOU
								</span>
							</div>
							<span className="text-sm leading-none font-medium text-muted-foreground">
								{identity.device_name}
							</span>
						</div>
					</li>
					{users.length === 0 && (
						<p className="text-muted-foreground">No other users yet</p>
					)}
					{users.map((u) => (
						<li key={"user-" + u.id} className="flex items-center gap-3">
							<div className="flex h-10 items-center justify-start rounded-lg text-xl text-neutral-400">
								<DeviceIcon deviceType={u.device_type} width={24} height={24} />
							</div>
							<div className="flex flex-1 flex-col justify-between py-0.5">
								<div className="flex items-center leading-none">
									{u.display_name}
									<span
										title={u.connectionState}
										className={cn(
											"ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold before:text-[8px] before:leading-none before:content-['●']",
											{
												"bg-neutral-200/80 text-neutral-700/80":
													u.connectionState === "disconnected",
												"bg-green-100 text-green-700/80":
													u.connectionState === "connected",
												"bg-yellow-100 text-yellow-700/80":
													u.connectionState === "connecting",
												"bg-red-100 text-red-700/80":
													u.connectionState === "failed",
											},
										)}
									>
										{u.connectionState}
									</span>
								</div>
								<span className="text-sm leading-none font-medium text-muted-foreground">
									{u.device_name}
								</span>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
