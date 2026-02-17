import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { $connectionState } from "#/stores/signaling";

export function useServer() {
	const connectionState = useStore($connectionState);

	return {
		server,
		connectionState,
	};
}
