import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { server } from "#/lib/server";
import { SessionManager } from "#/lib/session";
import { $session } from "#/stores/signaling";

const manager = new SessionManager(server);

const join = (id: string) => manager.join(id);
const leave = () => manager.leave();
const create = () => manager.create();

export function useSession(id?: string) {
	const session = useStore($session);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (!id) return;
		if (session && session.id === id) return;
		if (manager.state === "active" || manager.state === "joining") {
			return;
		}

		manager.join(id).catch((err) => {
			console.error(err);
			if (err instanceof Error) {
				setError(err.message);
				return;
			}
		});
	}, [id, session]);

	return {
		session,
		error,
		joinSession: join,
		leaveSession: leave,
		createSession: create,
	};
}
