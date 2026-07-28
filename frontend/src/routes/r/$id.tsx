import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { toTitleCase } from "#/lib/helper";
import {
	$connectionState,
	$identity,
	$networkUsers,
	$room,
} from "#/stores/signaling";
import { $peers } from "#/stores/peer";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Loader } from "#/components/ui/loader";
import { IconWireless } from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { OutgoingMessage, Room, User } from "#/lib/schemas";
import { useNotifications } from "#/hooks/use-notifications";
import { useResult } from "#/hooks/use-result";
import { useSignalingClient } from "#/hooks/use-signaling-client";
import { RoomArea } from "#/components/roomarea";
import { useWakeLock } from "#/hooks/use-wake-lock";

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
	const identity = useStore($identity);
	const room = useStore($room);
	const peers = useStore($peers);
	useNotifications();
	const networkUsers = useStore($networkUsers);
	const nearbyUsers = networkUsers.filter((usr) => {
		return room?.users?.find((u) => u.id === usr.id) === undefined;
	});

	const { status, error } = useResult(() => client.joinRoom(id), connected);
	useEffect(() => {
		if (!connected) return;
		return () => {
			client.leaveRoom();
		};
	}, [client, connected]);

	useWakeLock();

	if (connectionState === "disconnected" || connectionState === "connecting") {
		return <Loader minTime={250} />;
	}
	if (connectionState === "failed") {
		return (
			<div className="my-16 flex flex-col items-center">
				<h1 className="mb-1 text-2xl font-bold">Connection error</h1>
				<p className="mb-3 text-muted-foreground">
					Failed to connect to the signaling server
				</p>
				<button
					onClick={() => window.location.reload()}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker"
				>
					Retry
				</button>
			</div>
		);
	}
	if (!identity) {
		return <Loader minTime={250} />;
	}

	if (status === "pending") {
		return <Loader minTime={250} />;
	}
	if (status === "error") {
		return <RoomError message={error.message} />;
	}
	if (status === "success" && !room) {
		return <Loader minTime={250} />;
	}

	if (!room) {
		return <RoomError message="Room not found" />;
	}

	return (
		<Main className="max-w-screen-sm gap-8 pt-3 sm:pt-3">
			<RoomArea identity={identity} room={room} peers={peers} />
			<InviteArea
				onSignal={(m) => client.send(m)}
				room={room}
				nearbyUsers={nearbyUsers}
			/>
			<FileArea />
		</Main>
	);
}

function InviteArea({
	onSignal,
	nearbyUsers,
	room,
}: {
	onSignal: (m: OutgoingMessage) => Promise<void>;
	nearbyUsers: User[];
	room: Room;
}) {
	function inviteUser(id: string) {
		onSignal({
			type: "invite-to-room",
			payload: { user_id: id, room_id: room.id },
		});
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2">
				<span className="flex size-9.5 items-center justify-center rounded-lg bg-primary/20 text-lg text-primary">
					<IconWireless />
				</span>
				<div className="flex flex-col">
					<Heading order={2}>Nearby devices</Heading>
					<p className="text-sm text-muted-foreground">
						Invite devices on the same network
					</p>
				</div>
			</div>
			{nearbyUsers.length === 0 ? (
				<p className="text-sm text-muted-foreground">No other devices</p>
			) : (
				<ul className="flex flex-col gap-3">
					{nearbyUsers.map((u) => (
						<li key={"nearby-" + u.id} className="flex gap-3">
							<div className="flex flex-1 flex-col justify-between">
								<p className="leading-none">{u.username}</p>
								<span className="text-sm leading-none font-medium text-muted-foreground">
									{u.device_name}
								</span>
							</div>
							<InviteButton onClick={() => inviteUser(u.id)} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function RoomError({ message }: { message: string }) {
	return (
		<div className="my-12 flex flex-col items-center">
			<h1 className="mb-3 text-lg font-semibold">{toTitleCase(message)}</h1>
			<Link
				to="/app"
				className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker"
			>
				Home
			</Link>
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
