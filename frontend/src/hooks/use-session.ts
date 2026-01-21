import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { $session, SessionManager } from "#/lib/session";
import { useServer } from "./use-server";

const manager = new SessionManager(server);

const join = (id: string) => manager.join(id);
const leave = () => manager.leave();
const create = () => manager.create();

export function useSession(id?: string) {
	const session = useStore($session);
	const { connectionState } = useServer();
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (connectionState !== "open") return;
		if (!id) return;
		if (session && session.id === id) {
			return;
		}
		if (manager.state === "active" || manager.state === "joining") {
			return;
		}
		manager
			.join(id)
			.then((s) => s)
			.catch((err) => {
				console.error(err);
				if (err instanceof Error) {
					setError(err.message);
					return;
				}
			});
	}, [connectionState, id, session]);

	return {
		session,
		error,
		joinSession: join,
		leaveSession: leave,
		createSession: create,
	};
}
