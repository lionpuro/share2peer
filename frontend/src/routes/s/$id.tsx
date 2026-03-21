import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { cn, toTitleCase } from "#/lib/helper";
import { $connectionState, $identity, $networkUsers } from "#/stores/signaling";
import { $peers, type PeerState } from "#/stores/peer";
import { useJoinRoom, useRoom } from "#/hooks/use-room";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import {
	IconCheck,
	IconCopy,
	IconInvite,
	IconShare,
	IconX,
} from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { Room, User } from "#/lib/schemas";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { server } from "#/lib/server";

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

	const [dialogOpen, setDialogOpen] = useState(false);
	const [copiedURL, setCopiedURL] = useState(false);
	const [copiedID, setCopiedID] = useState(false);
	const roomURL = `${window.location.protocol}//${window.location.host}/s/${room.id}`;
	const networkUsers = useStore($networkUsers);

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

	const supportsShare = typeof navigator.share === "function";

	function shareURL() {
		if (supportsShare) {
			navigator.share({ url: roomURL });
		}
	}

	function inviteUser(id: string) {
		server.send({
			type: "invite-to-room",
			payload: { user_id: id, room_id: room.id },
		});
	}

	return (
		<div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
			<div className="flex flex-wrap items-start">
				<span className="mr-2 font-bold">Room:</span>
				<p className="mr-1 font-medium outline-none">{room.id}</p>
				<Button
					disabled={copiedID}
					onClick={copyID}
					variant="ghost"
					title="Copy"
					className="size-7 p-0 text-muted-foreground/75 hover:text-muted-foreground disabled:bg-transparent"
				>
					{!copiedID ? (
						<IconCopy className="text-xs" />
					) : (
						<IconCheck className="text-sm" />
					)}
				</Button>
				<Button
					onClick={() => setDialogOpen(true)}
					className="ml-auto gap-1.5 py-1.75"
				>
					<IconInvite />
					Invite
				</Button>
			</div>
			<div className="mt-2 flex flex-col gap-2">
				<Heading order={2} size="sm">
					Users
				</Heading>
				<ul className="flex flex-col gap-2">
					<li key={identity.id} className="flex items-center gap-3">
						<div className="flex flex-1 flex-col justify-between">
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
					{users.map((u) => (
						<li key={"user-" + u.id} className="flex items-center gap-3">
							<div className="flex flex-1 flex-col justify-between">
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
			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				className="w-full max-w-md text-foreground max-sm:p-4"
			>
				<DialogContent className="relative w-full bg-card">
					<Heading order={2} className="mb-6">
						Invite
					</Heading>
					<button
						title="Close"
						onClick={() => setDialogOpen(false)}
						className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
					>
						<IconX />
					</button>
					<div className="mb-6 flex hidden flex-col items-center gap-1">
						<span className="text-sm font-semibold text-muted-foreground">
							Room ID
						</span>
						<p className="w-fit rounded-lg border px-3 py-1.5 text-xl font-bold">
							{room.id}
						</p>
					</div>

					<div className="mb-4 flex flex-col gap-1 border-b pb-4">
						<label
							htmlFor="room-id"
							className="text-sm font-semibold text-muted-foreground"
						>
							Room ID
						</label>
						<span
							id="room-id"
							className="mb-3 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium"
						>
							{room.id}
						</span>
						<label
							htmlFor="room-url"
							className="text-sm font-semibold text-muted-foreground"
						>
							Room URL
						</label>
						<div className="flex flex-wrap gap-2">
							<input
								id="room-url"
								readOnly={true}
								value={roomURL}
								className="flex-1 overflow-x-scroll rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-ellipsis outline-none"
							/>
							{!supportsShare && (
								<Button
									disabled={copiedURL}
									onClick={copyURL}
									title="Copy"
									className="gap-1.5 px-3 py-1.5"
								>
									<span className="flex justify-end">
										{!copiedURL ? (
											<IconCopy className="text-xs" />
										) : (
											<IconCheck className="text-xs" />
										)}
									</span>
									Copy
								</Button>
							)}
						</div>
						{supportsShare && (
							<div className="mt-2 flex gap-3">
								<Button
									variant="ghost"
									onClick={shareURL}
									className="basis-1/2 gap-1.5 border border-primary py-1.75 text-primary"
								>
									<IconShare />
									Share
								</Button>
								<Button
									disabled={copiedURL}
									onClick={copyURL}
									title="Copy"
									className="basis-1/2 gap-1.5 px-3 py-1.75"
								>
									{!copiedURL ? (
										<>
											<IconCopy className="text-xs" />
											Copy
										</>
									) : (
										<>
											<IconCheck className="text-xs" />
											Copied
										</>
									)}
								</Button>
							</div>
						)}
					</div>
					<Heading order={3} className="mb-1">
						Network users
					</Heading>
					<p className="mb-3 text-sm font-medium text-muted-foreground">
						Other devices on the same network will appear here.
					</p>
					<ul className="flex flex-col gap-2">
						{networkUsers.length === 0 && (
							<p className="text-muted-foreground">No users</p>
						)}
						{networkUsers.map((u) => (
							<li key={"nw-" + u.id} className="flex items-center gap-3">
								<div className="flex flex-1 flex-col justify-between">
									<div className="flex items-center leading-none">
										{u.display_name}
									</div>
									<span className="text-sm leading-none font-medium text-muted-foreground">
										{u.device_name}
									</span>
								</div>
								{users.find((user) => user.id === u.id) === undefined ? (
									<Button
										variant="ghost"
										className="border border-primary py-1.5 font-semibold text-primary hover:bg-primary hover:text-background active:border-primary-darker active:bg-primary-darker"
										onClick={() => inviteUser(u.id)}
									>
										Invite
									</Button>
								) : (
									<p className="py-1.75 text-sm font-medium text-muted-foreground">
										Connected
									</p>
								)}
							</li>
						))}
					</ul>
				</DialogContent>
			</Dialog>
		</div>
	);
}
