import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSocket } from "../lib/socket";
import { Main } from "../components/main";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const { session, requestSession, leaveSession } = useSession();
	const [shareCode, setShareCode] = useState("");
	const { connected } = useSocket();

	function handleCreate() {
		if (!connected) {
			console.log("WebSocket not connected, waiting for a reconnect...");
			return;
		}
		requestSession();
	}

	useEffect(() => {
		if (!connected) {
			return;
		}
		if (session?.id) {
			leaveSession(session.id);
		}
	}, [connected, session, leaveSession]);

	return (
		<Main>
			<h3 className="mb-2 text-xl font-semibold">Share</h3>
			<button
				className="mb-4 w-fit rounded-md bg-primary-600/90 px-3 py-1.5 text-sm text-white hover:bg-primary-600"
				onClick={handleCreate}
			>
				Create session
			</button>
			<h3 className="mb-2 text-xl font-semibold">Receive</h3>
			<div className="flex items-center gap-2">
				<label htmlFor="input-code">Enter a code:</label>
				<input
					id="input-code"
					placeholder="ABC123"
					minLength={6}
					maxLength={6}
					value={shareCode}
					onChange={(e) => setShareCode(e.target.value.toUpperCase())}
					className="w-[calc(6ch+1.5rem)] rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-sm"
				/>
				<Link
					to="/s/$code"
					params={{ code: shareCode }}
					className={`rounded-lg px-3 py-1.75 text-sm font-medium ${shareCode.length !== 6 ? "bg-neutral-300/60 text-neutral-500" : "bg-primary-600/90 text-white"}`}
					disabled={shareCode.length !== 6}
				>
					Enter
				</Link>
			</div>
		</Main>
	);
}
