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
import { ErrorComponent } from "#/components/error";
import { IconWireless } from "#/components/icons";
import { FileArea } from "#/components/filearea";
import { Heading } from "#/components/ui/heading";
import type { OutgoingMessage, Room, User } from "#/lib/schemas";
import { useNotifications } from "#/hooks/use-notifications";
import { joinRoom, leaveRoom, roomState } from "#/lib/signaling/room";
import { useResult } from "#/hooks/hooks";
import { useSignalingClient } from "#/hooks/signaling";
import { RoomArea } from "#/components/roomarea";

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
	const networkUsers = useStore($networkUsers);
	const nearbyUsers = networkUsers.filter((u) => !peers[u.id]);

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
