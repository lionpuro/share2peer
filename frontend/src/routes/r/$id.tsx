import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { toTitleCase } from "#/lib/helper";
import { $connectionState, $identity, $room } from "#/stores/signaling";
import { $peers } from "#/stores/peer";
import { Main } from "#/components/ui/main";
import { Loader } from "#/components/ui/loader";
import { ErrorComponent } from "#/components/error";
import { FileArea } from "#/components/filearea";
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
