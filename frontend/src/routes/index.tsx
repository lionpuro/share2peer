import { useState, type KeyboardEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { Footer } from "#/components/footer";
import {
	IconConnect,
	IconDevices,
	IconInfinity,
	IconPlus,
	IconX,
} from "#/components/icons";
import { toast } from "react-toastify";
import { createRoom } from "#/lib/signaling/room";
import { useNotifications } from "#/hooks/use-notifications";
import { useSignalingClient } from "#/hooks/signaling";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const navigate = useNavigate();
	const client = useSignalingClient();
	const [joinCode, setJoinCode] = useState("");
	const [creating, setCreating] = useState(false);
	useNotifications();

	async function handleCreate() {
		setCreating(true);
		try {
			const { id } = await createRoom(client);
			navigate({ to: "/r/$id", params: { id } });
		} catch (err) {
			console.error("create room:", err);
			toast.error("Failed to create room");
		} finally {
			setCreating(false);
		}
	}

	function handleCodeKeyUp(e: KeyboardEvent<HTMLInputElement>) {
		e.preventDefault();
		if (e.key !== "Enter") return;
		if (joinCode.length < 6) return;
		navigate({ to: "/r/$id", params: { id: joinCode } });
	}

	return (
		<>
			<Main className="min-h-[calc(100vh-3.25rem)] max-w-screen-lg">
				<div className="my-12 flex items-center gap-8 max-md:mx-auto max-md:flex-col md:my-auto md:pb-16">
					<div className="flex flex-col max-md:items-center max-md:text-center md:my-auto">
						<h1 className="mb-2 w-full text-3xl leading-none font-bold tracking-tight text-balance md:mb-2 md:text-4xl">
							Quick file sharing for every device
						</h1>
						<p className="mb-2 text-balance text-foreground/80 md:mt-auto">
							Private file transfers without size limits. No setup, no accounts.
							Completely free.
						</p>
						<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground max-md:justify-center">
							<span className="flex items-center gap-2">
								<IconConnect />
								Peer-to-peer
							</span>
							<span className="flex items-center gap-2">
								<IconDevices />
								Cross-platform
							</span>
							<span className="flex items-center gap-2">
								<IconInfinity />
								No size limits
							</span>
						</div>
					</div>
					<div className="flex w-full max-w-xs flex-col gap-2 rounded-xl border bg-card/50 p-6 max-md:mx-auto max-md:mt-12 md:ml-auto md:min-w-xs">
						<span className="text-sm">Create a room to start sharing</span>
						<Button
							onClick={handleCreate}
							className="gap-1"
							disabled={creating}
						>
							<IconPlus />
							New Room
						</Button>
						<span className="my-1 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground before:h-0.5 before:flex-1 before:bg-border before:content-['_'] after:h-0.5 after:flex-1 after:bg-border after:content-['_']">
							OR
						</span>
						<span className="text-sm">Enter a code to join a room</span>
						<div className="flex items-center gap-3">
							<div className="relative flex flex-1">
								<input
									id="input-code"
									placeholder="ABC123"
									minLength={6}
									maxLength={6}
									value={joinCode}
									onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
									onKeyUp={handleCodeKeyUp}
									className="w-full rounded-lg border bg-background px-2 py-1.25 font-mono placeholder:text-muted-foreground dark:bg-muted/50"
								/>
								{joinCode.length > 0 && (
									<button
										onClick={() => setJoinCode("")}
										className="absolute right-0 p-2"
									>
										<IconX className="text-muted-foreground hover:text-foreground" />
									</button>
								)}
							</div>
							<Link
								to="/r/$id"
								params={{ id: joinCode }}
								className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${joinCode.length !== 6 ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary-darker"}`}
								disabled={joinCode.length !== 6}
							>
								Join
							</Link>
						</div>
					</div>
				</div>
			</Main>
			<Footer />
		</>
	);
}
