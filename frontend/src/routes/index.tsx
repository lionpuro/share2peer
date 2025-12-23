import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Main } from "#/components/main";
import { useSocket } from "#/hooks/use-socket";
import { useSession } from "#/hooks/use-session";
import { Loader } from "#/components/loader";
import type {
	MessageEventListener,
	MessageEventMap,
	MessageType,
} from "#/lib/message";
import { SessionView } from "#/components/session";

type SearchParams = {
	s?: string;
};

export const Route = createFileRoute("/")({
	component: Component,
	validateSearch: (input: Record<string, unknown>): SearchParams => {
		if (!("s" in input) || typeof input["s"] !== "string") {
			return {};
		}
		if (input.s.length !== 6) {
			return {};
		}
		return { s: input.s };
	},
});

function Component() {
	const { s: sessionID } = Route.useSearch();
	const navigate = useNavigate();
	const { session, requestSession, joinSession, leaveSession } = useSession();
	const [joinCode, setJoinCode] = useState("");
	const { socket, connectionState } = useSocket();

	function handleCreate() {
		if (connectionState !== "open") {
			console.log("WebSocket not connected, waiting for a reconnect...");
			return;
		}
		requestSession();
	}

	const handleCreated: MessageEventListener<typeof MessageType.SessionCreated> =
		useCallback(
			(e) => {
				const msg = e.detail;
				navigate({ to: ".", search: { s: msg.payload.session_id } });
			},
			[navigate],
		);

	useEffect(() => {
		const handleError = (e: MessageEventMap["error"]) => {
			const err = e.detail.payload;
			if (err.includes("session does not exist")) {
				console.error(err);
				navigate({ from: Route.fullPath, search: {} });
			}
		};
		socket.addEventListener("session-created", handleCreated);
		socket.addEventListener("error", handleError);

		return () => {
			socket.removeEventListener("session-created", handleCreated);
			socket.removeEventListener("error", handleError);
		};
	}, [socket, navigate, handleCreated]);

	useEffect(() => {
		if (connectionState !== "open") {
			return;
		}
		if (sessionID && session?.id) {
			return;
		}
		if (sessionID && session?.id !== sessionID) {
			joinSession(sessionID);
		}
		return () => {
			if (session?.id) {
				leaveSession(session.id);
			}
		};
	}, [connectionState, sessionID, session, joinSession, leaveSession]);

	if (connectionState !== "open" && connectionState !== "error") {
		return <Loader />;
	}
	if (sessionID && !session) {
		return <Loader />;
	}

	return (
		<Main>
			{session && <SessionView session={session} />}
			{!session && (
				<>
					<h3 className="mb-2 text-xl font-semibold">New session</h3>
					<button
						className="mb-4 w-fit rounded-md bg-primary px-3 py-1.5 text-white hover:bg-primary-darker"
						onClick={handleCreate}
					>
						Create session
					</button>
					<h3 className="mb-2 text-xl font-semibold">Join session</h3>
					<div className="flex items-center gap-2">
						<label htmlFor="input-code">Enter a code:</label>
						<input
							id="input-code"
							placeholder="ABC123"
							minLength={6}
							maxLength={6}
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							className="w-[calc(6ch+1.5rem)] rounded-md border border-neutral-300 px-2 py-1.5 font-mono"
						/>
						<Link
							from={Route.fullPath}
							search={{ s: joinCode }}
							className={`rounded-lg px-4 py-1.75 font-medium ${joinCode.length !== 6 ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary-darker"}`}
							disabled={joinCode.length !== 6}
						>
							Join
						</Link>
					</div>
				</>
			)}
		</Main>
	);
}
