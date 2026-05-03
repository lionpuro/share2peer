import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { cn, toTitleCase } from "#/lib/helper";
import {
	$connectionState,
	$identity,
	$networkUsers,
	$room,
	setSessionData,
} from "#/stores/signaling";
import { $peers, type PeerState } from "#/stores/peer";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import {
	IconCheck,
	IconCopy,
	IconAccountGroup,
	IconInvite,
	IconPencil,
	IconShare,
	IconX,
} from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { OutgoingMessage, Room, User } from "#/lib/schemas";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { useNotifications } from "#/hooks/use-notifications";
import { joinRoom, leaveRoom, roomState } from "#/lib/signaling/room";
import { useResult } from "#/hooks/hooks";
import { useSignalingClient } from "#/hooks/signaling";

export const Route = createFileRoute("/r/$id")({
	component: Component,
	head: (ctx) => ({
		meta: [{ title: `Room ${ctx.params.id} | Websend` }],
	}),
});

function Component() {
	const { id } = Route.useParams();
	const client = useSignalingClient();
	const connectionState = useStore($connectionState);
	const connected = connectionState === "connected";
	const room = useStore($room);
	useNotifications();
	const identity = useStore($identity);
	const peers = useStore($peers);
	const { status, error } = useResult(() => joinRoom(client, id), !connected);
	useEffect(() => {
		if (!connected) return;
		return () => {
			if (roomState() === "active") {
				leaveRoom(client);
			}
		};
	}, [client, connected]);

	if (connectionState === "connecting" || !identity) {
		return <Loader />;
	}

	if (status === "pending") {
		return <Loader />;
	}
	if (status === "error") {
		return <RoomError message={error.message} />;
	}
	if (status === "success" && !room) {
		return <Loader />;
	}

	if (!room) {
		return <RoomError message="Room not found" />;
	}

	if (connectionState !== "connected") {
		return "Failed to connect";
	}

	return (
		<Main className="max-w-screen-sm gap-4 pt-3 sm:pt-3">
			<RoomArea
				onSignal={(m) => client.send(m)}
				identity={identity}
				room={room}
				peers={peers}
			/>
			<FileArea />
		</Main>
	);
}

function RoomError({ message }: { message: string }) {
	return (
		<ErrorComponent error={toTitleCase(message)}>
			<Link
				to="/"
				className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-darker"
			>
				Back
			</Link>
		</ErrorComponent>
	);
}

function RoomArea({
	onSignal,
	identity,
	room,
	peers,
}: {
	onSignal: (m: OutgoingMessage) => Promise<void>;
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

	const [inviteOpen, setInviteOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [copiedURL, setCopiedURL] = useState(false);
	const [copiedID, setCopiedID] = useState(false);
	const roomURL = `${window.location.protocol}//${window.location.host}/r/${room.id}`;
	const networkUsers = useStore($networkUsers);
	const usernameRef = useRef<HTMLInputElement>(null);

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
		onSignal({
			type: "invite-to-room",
			payload: { user_id: id, room_id: room.id },
		});
	}

	function updateUsername() {
		const username = usernameRef.current?.value;
		if (!username) return;
		setSessionData({ username });
		window.location.reload();
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
				<div className="flex gap-2">
					<span className="flex size-9.5 items-center justify-center rounded-lg bg-primary/20 text-lg text-primary">
						<IconAccountGroup />
					</span>
					<div className="flex flex-col">
						<Heading order={2}>Room</Heading>
						<p className="text-sm text-muted-foreground">{`ID: ${room.id}`}</p>
					</div>
					<Button
						onClick={() => setInviteOpen(true)}
						className="ml-auto gap-1.5 py-1.75"
					>
						<IconInvite />
						Invite
					</Button>
				</div>
				<ul className="flex flex-col gap-2">
					<li key={identity.id} className="flex items-center gap-3">
						<div className="flex flex-1 flex-col justify-between">
							<div className="flex items-center leading-none">
								{identity.username}
								<button
									title="Edit username"
									className="ml-1 text-muted-foreground/80"
									onClick={() => setEditOpen(true)}
								>
									<IconPencil />
								</button>
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
									{u.username}
									<span
										title={u.connectionState}
										className={cn(
											"ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold before:text-[8px] before:leading-none before:content-['●']",
											{
												"bg-neutral-200/80 text-neutral-700/80 dark:text-muted-foreground":
													u.connectionState === "disconnected",
												"bg-green-100 text-green-700/80 dark:text-green-500":
													u.connectionState === "connected",
												"bg-yellow-100 text-yellow-700/80 dark:text-yellow-500":
													u.connectionState === "connecting",
												"bg-red-100 text-red-700/80 dark:text-red-500":
													u.connectionState === "failed",
											},
											"dark:border dark:bg-muted dark:py-0.25",
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
			<Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
				<DialogContent>
					<Heading
						order={2}
						className="mb-6 focus:outline-none"
						autoFocus
						tabIndex={0}
					>
						Invite
					</Heading>
					<button
						title="Close"
						onClick={() => setInviteOpen(false)}
						className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
					>
						<IconX />
					</button>
					<div className="mb-8 flex flex-col">
						<label
							htmlFor="room-id"
							className="mb-1 text-sm font-semibold text-muted-foreground"
						>
							Room ID
						</label>
						<span className="mb-4 flex items-center rounded-lg border bg-card text-sm font-medium dark:border-neutral-700 dark:bg-neutral-700/50">
							<span id="room-id" className="px-3 py-1.5">
								{room.id}
							</span>
							<Button
								title="Copy"
								variant="ghost"
								size="icon-sm"
								className="ml-auto text-muted-foreground hover:text-foreground disabled:bg-transparent"
								onClick={copyID}
								disabled={copiedID}
							>
								{!copiedID ? <IconCopy /> : <IconCheck />}
							</Button>
						</span>
						<label
							htmlFor="room-url"
							className="mb-1 text-sm font-semibold text-muted-foreground"
						>
							Room URL
						</label>
						<div className="flex flex-wrap gap-2">
							<div className="flex flex-1 rounded-lg border bg-card dark:border-neutral-700 dark:bg-neutral-700/50">
								<input
									id="room-url"
									readOnly={true}
									value={roomURL}
									className="flex-1 overflow-x-scroll px-3 py-1.5 text-sm font-medium text-ellipsis"
								/>
								{!supportsShare && (
									<Button
										title="Copy"
										variant="ghost"
										size="icon-sm"
										className="ml-auto text-sm text-muted-foreground hover:text-foreground disabled:bg-transparent"
										onClick={copyURL}
										disabled={copiedURL}
									>
										{!copiedURL ? <IconCopy /> : <IconCheck />}
									</Button>
								)}
							</div>
						</div>
						{supportsShare && (
							<div className="mt-3 flex gap-3">
								<Button
									variant="ghost"
									onClick={shareURL}
									className="basis-1/2 gap-1.5 border border-primary py-1.5 text-primary"
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
						Nearby devices
					</Heading>
					<p className="mb-3 text-sm text-muted-foreground">
						Other devices on the same network will appear here.
					</p>
					<ul className="flex flex-col gap-3">
						{networkUsers.length === 0 && (
							<p className="text-muted-foreground">No devices</p>
						)}
						{networkUsers.map((u) => (
							<li key={"nw-" + u.id} className="flex gap-3">
								<div className="flex flex-1 flex-col justify-between">
									<p className="leading-none">{u.username}</p>
									<span className="text-sm leading-none font-medium text-muted-foreground">
										{u.device_name}
									</span>
								</div>
								{users.find((user) => user.id === u.id) === undefined ? (
									<InviteButton onClick={() => inviteUser(u.id)} />
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
			<Dialog open={editOpen} onClose={() => setEditOpen(false)}>
				<DialogContent>
					<Heading order={2} className="mb-4 focus:outline-none">
						Edit username
					</Heading>
					<input
						ref={usernameRef}
						defaultValue={identity.username}
						onKeyDown={(e) => e.key === "Enter" && updateUsername()}
						className="mb-4 rounded-lg border bg-card px-3 py-1.25"
					/>
					<div className="flex gap-4">
						<Button
							onClick={() => setEditOpen(false)}
							className="basis-1/2 bg-secondary/80 hover:bg-secondary"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button onClick={updateUsername} className="basis-1/2">
							Save
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function InviteButton({ onClick }: { onClick: () => void }) {
	const [invited, setInvited] = useState(false);
	function handleClick() {
		if (invited) return;
		setInvited(true);
		setTimeout(() => setInvited(false), 1500);
		onClick();
	}
	return (
		<Button
			variant="ghost"
			className="min-w-18 border border-primary px-0 py-1.5 font-semibold text-primary hover:bg-primary hover:text-background active:border-primary-darker active:bg-primary-darker disabled:border-transparent disabled:bg-transparent disabled:text-primary"
			disabled={invited}
			onClick={handleClick}
		>
			{!invited ? "Invite" : "Invited!"}
		</Button>
	);
}
