import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useStore } from "@nanostores/react";
import { $isConnected, $session, websocket } from "../lib/socket";
import { MessageType } from "../lib/message";
import { Main } from "../components/main";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const session = useStore($session);
	const connected = useStore($isConnected);
	const [requested, setRequested] = useState(false);
	const [shareCode, setShareCode] = useState("");
	async function handleCreate() {
		if (!connected) {
			console.log("WebSocket not connected, waiting for a reconnect...");
			return;
		}
		websocket.send({ type: MessageType.RequestSession });
		setRequested(true);
	}
	if (requested && session?.id) {
		return <Navigate to="/s/$code" params={{ code: session.id }} />;
	}
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
					className="w-[calc(6ch+1.5rem)] rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
				/>
				<Link
					to="/s/$code"
					params={{ code: shareCode }}
					className="rounded-lg bg-primary-600/90 px-3 py-1.75 text-sm font-medium text-white disabled:bg-neutral-300/60 disabled:text-neutral-500"
					disabled={!shareCode}
				>
					Enter
				</Link>
			</div>
		</Main>
	);
}
