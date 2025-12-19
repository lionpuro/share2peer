import { useStore } from "@nanostores/react";
import {
	$session,
	joinSession,
	leaveSession,
	requestSession,
} from "#/lib/session";

export function useSession() {
	const session = useStore($session);

	return { session, requestSession, joinSession, leaveSession };
}
