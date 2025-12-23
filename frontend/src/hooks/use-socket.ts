import { useStore } from "@nanostores/react";
import { $connectionState, socket } from "#/lib/socket";

export function useSocket() {
	const connectionState = useStore($connectionState);

	return {
		socket,
		connectionState,
	};
}
