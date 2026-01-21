import { useStore } from "@nanostores/react";
import { $connectionState, server } from "#/lib/server";

export function useServer() {
	const connectionState = useStore($connectionState);

	return {
		server,
		connectionState,
	};
}
