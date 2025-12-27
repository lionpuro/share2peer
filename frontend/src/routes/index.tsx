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
import { toast } from "react-toastify";
import { IconX } from "#/components/icons";

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
				toast.error(err);
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
		if (session && !sessionID) {
			leaveSession(session.id);
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
	if (connectionState === "error") {
		return (
			<Main>
				<p className="text-center">Failed to connect</p>
			</Main>
		);
	}
	if (sessionID && !session) {
		return <Loader />;
	}

	return (
		<Main>
			{session && <SessionView session={session} />}
			{!session && (
				<div className="mx-auto mt-4 flex w-full max-w-xs flex-col">
					<h3 className="mb-6 text-lg leading-none font-bold">Join Session</h3>
					<div className="relative flex">
						<input
							id="input-code"
							placeholder="ABC123"
							minLength={6}
							maxLength={6}
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							className="mb-4 flex-1 rounded-lg border border-secondary px-2 py-1.25 font-mono placeholder:text-neutral-400"
						/>
						{joinCode.length > 0 && (
							<button
								onClick={() => setJoinCode("")}
								className="absolute right-0 p-2"
							>
								<IconX
									size={20}
									className="text-muted-foreground hover:text-foreground"
								/>
							</button>
						)}
					</div>
					<Link
						from={Route.fullPath}
						search={{ s: joinCode }}
						className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${joinCode.length !== 6 ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary-darker"}`}
						disabled={joinCode.length !== 6}
					>
						Join
					</Link>
					<div className="my-6 flex items-center gap-2">
						<hr className="h-0.5 flex-1 rounded-xs border-none bg-secondary" />
						<span className="text-sm font-medium text-neutral-500">OR</span>
						<hr className="h-0.5 flex-1 rounded-xs border-none bg-secondary" />
					</div>
					<h3 className="mb-6 text-lg leading-none font-bold">
						Create session
					</h3>
					<button
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker"
						onClick={handleCreate}
					>
						Create
					</button>
				</div>
			)}
		</Main>
	);
}
