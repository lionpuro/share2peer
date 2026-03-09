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
import {
	DeviceIcon,
	IconCheck,
	IconCopy,
	IconExit,
	IconShare,
	IconWifi,
} from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { Room, User } from "#/lib/schemas";

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
		<div className="flex flex-col gap-4 rounded-xl border p-4">
			<div className="flex items-center gap-2">
				<span className="font-bold">Room:</span>
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
				<Link
					to="/"
					replace={users.length === 0}
					className="ml-auto flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium text-red-600/80 hover:bg-secondary/25"
				>
					<IconExit className="text-xs" />
					Leave
				</Link>
			</div>
			<div className="flex flex-wrap gap-2">
				<div className="flex flex-1 rounded-lg border">
					<input
						id="room-url"
						readOnly={true}
						value={roomURL}
						className="flex-1 overflow-x-scroll py-1.5 pl-3 text-sm font-medium outline-none"
					/>
					<Button
						disabled={copiedURL}
						onClick={copyURL}
						variant="ghost"
						title="Copy"
						className="size-8 p-0 text-muted-foreground/75 hover:text-muted-foreground disabled:bg-transparent"
					>
						{!copiedURL ? (
							<IconCopy className="text-xs" />
						) : (
							<IconCheck className="text-sm" />
						)}
					</Button>
				</div>
				{typeof navigator.share === "function" && (
					<Button onClick={shareURL} className="gap-2 py-1 pl-3">
						<IconShare />
						Share
					</Button>
				)}
			</div>
			<div className="flex flex-col gap-3">
				<Heading order={2} size="sm">
					Users
				</Heading>
				<ul className="flex flex-col gap-2">
					<li key={identity.id} className="flex items-center gap-2">
						<DeviceIcon
							deviceType={identity.device_type}
							width={16}
							height={16}
						/>
						<p className="py-0.5 leading-none">{identity.display_name}</p>
						<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
							YOU
						</span>
					</li>
					{users.length === 0 && (
						<p className="py-0.75 text-sm leading-none text-muted-foreground">
							No other users yet
						</p>
					)}
					{users.map((u) => (
						<li key={"user-" + u.id} className="flex items-center gap-2">
							<DeviceIcon deviceType={u.device_type} width={16} height={16} />
							<p className="py-0.5 leading-none">{u.display_name}</p>
							<span
								title={u.connectionState}
								className={cn(
									"ml-auto cursor-pointer text-sm text-muted-foreground",
									{
										"text-green-600/80": u.connectionState === "connected",
										"text-yellow-600/80": u.connectionState === "connecting",
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
		</div>
	);
}
