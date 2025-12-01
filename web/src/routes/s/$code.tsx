import { createFileRoute } from "@tanstack/react-router";
import { $isConnected, $session, websocket } from "../../lib/socket";
import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { MessageType } from "../../lib/message";
import { Loader } from "../../components/loader";
import { IconCheck, IconCopy } from "../../icons";
import { Main } from "../../components/main";

export const Route = createFileRoute("/s/$code")({
	component: Component,
});

function Component() {
	const { code } = Route.useParams();
	const session = useStore($session);
	const connected = useStore($isConnected);
	const sessionURL = `${window.location.protocol}//${window.location.host}/s/${code}`;
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!connected) {
			return;
		}
		if (!session?.id || session?.id !== code) {
			websocket.send({
				type: MessageType.JoinSession,
				payload: { session_id: code },
			});
		}
	}, [code, session, connected]);
	if (!connected) {
		return <Loader text="Connecting..." />;
	}
	if (!session) {
		return "Session not found";
	}
	function handleCopy() {
		setCopied(true);
		navigator.clipboard.writeText(sessionURL);
		setTimeout(() => {
			setCopied(false);
		}, 1000);
	}
	return (
		<Main>
			<div className="mx-auto my-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border-2 border-neutral-300/80 p-8">
				<div className="rounded-lg bg-neutral-200 px-4 py-2 font-mono text-5xl font-semibold">
					{code}
				</div>
				<p className="text-center text-sm">
					Input this session code on another device or join using the link.
				</p>
				<div className="mb-4 flex w-full gap-2">
					<input
						readOnly={true}
						value={sessionURL}
						className="grow rounded-lg border border-neutral-300 px-2 py-1.5 outline-none"
					/>
					<button
						disabled={copied}
						onClick={handleCopy}
						className="flex size-10 items-center justify-center rounded-lg bg-neutral-200 hover:bg-neutral-300/80"
					>
						{copied ? <IconCheck size={22} /> : <IconCopy size={18} />}
					</button>
				</div>
				<div>Connected users: {session.clients.length}/2</div>
				{session.clients.length < 2
					? "Waiting for a peer to connect"
					: "Ready to share files"}
			</div>
		</Main>
	);
}
