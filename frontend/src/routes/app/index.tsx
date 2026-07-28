import { useRef, useState, type KeyboardEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import {
	IconAccount,
	IconArrowRight,
	IconPencil,
	IconPlus,
	IconX,
} from "#/components/icons";
import { Main } from "#/components/ui/main";
import { Button } from "#/components/ui/button";
import { useSignalingClient } from "#/hooks/use-signaling-client";
import { useStore } from "@nanostores/react";
import {
	$connectionState,
	$identity,
	setSessionData,
} from "#/stores/signaling";
import { useNotifications } from "#/hooks/use-notifications";
import { Loader } from "#/components/ui/loader";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { Heading } from "#/components/ui/heading";

export const Route = createFileRoute("/app/")({
	component: Component,
});

function Component() {
	const navigate = useNavigate();
	const client = useSignalingClient();
	const connectionState = useStore($connectionState);
	const identity = useStore($identity);
	const [joinCode, setJoinCode] = useState("");
	const [creating, setCreating] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	useNotifications();
	const usernameRef = useRef<HTMLInputElement>(null);

	function updateUsername() {
		const username = usernameRef.current?.value;
		if (!username) return;
		setSessionData({ username });
		window.location.reload();
	}

	async function handleCreate() {
		setCreating(true);
		try {
			const { id } = await client.createRoom();
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

	if (connectionState === "disconnected" || connectionState === "connecting") {
		return <Loader minTime={250} />;
	}
	if (connectionState === "failed") {
		return (
			<div className="my-16 flex flex-col items-center">
				<h1 className="mb-1 text-2xl font-bold">Connection error</h1>
				<p className="mb-3 text-muted-foreground">
					Failed to connect to the signaling server
				</p>
				<button
					onClick={() => window.location.reload()}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker"
				>
					Retry
				</button>
			</div>
		);
	}
	if (!identity) {
		return <Loader minTime={250} />;
	}

	return (
		<Main>
			<div className="mx-auto flex w-full flex-col items-center max-sm:pb-14">
				<div className="mx-auto mb-4 flex w-full max-w-xs gap-2 rounded-xl border bg-card/50 p-3">
					<span className="flex size-9.5 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-lg text-primary">
						<IconAccount />
					</span>
					<div className="flex flex-1 flex-col justify-between">
						<div className="flex items-center leading-none">
							{identity.username}
							<button
								title="Edit username"
								className="ml-1 text-muted-foreground/80"
								onClick={() => setEditOpen(true)}
							>
								<IconPencil />
							</button>
						</div>
						<span className="text-sm font-medium text-muted-foreground">
							{identity.device_name}
						</span>
					</div>
				</div>
				<div className="flex w-full max-w-xs flex-col gap-2 rounded-xl border bg-card/50 p-6 max-md:mx-auto md:min-w-xs">
					<span className="font-bold">Create a room</span>
					<Button
						onClick={handleCreate}
						className="mt-1 gap-1 disabled:bg-secondary"
						disabled={creating}
					>
						<IconPlus />
						New room
					</Button>
					<span className="my-1 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground before:h-0.5 before:flex-1 before:bg-border before:content-['_'] after:h-0.5 after:flex-1 after:bg-border after:content-['_']">
						OR
					</span>
					<span className="font-bold">Join existing</span>
					<label htmlFor="input-code" className="text-sm">
						Room code
					</label>
					<div className="relative flex flex-1">
						<input
							id="input-code"
							name="input-code"
							placeholder="ABC123"
							minLength={6}
							maxLength={6}
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							onKeyUp={handleCodeKeyUp}
							className="w-full rounded-lg border bg-background px-2 py-1.25 placeholder:text-muted-foreground dark:bg-muted/50"
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
						className={`mt-1 flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-center text-sm font-medium ${joinCode.length !== 6 ? "cursor-not-allowed bg-secondary/60 text-muted-foreground dark:bg-secondary/50" : "bg-primary text-white hover:bg-primary-darker"}`}
						disabled={joinCode.length !== 6}
					>
						Join room <IconArrowRight />
					</Link>
				</div>
			</div>
			<Dialog open={editOpen} onClose={() => setEditOpen(false)}>
				<DialogContent>
					<Heading order={2} className="mb-4 focus:outline-none">
						Edit username
					</Heading>
					<input
						ref={usernameRef}
						defaultValue={identity.username}
						onKeyDown={(e) => e.key === "Enter" && updateUsername()}
						className="mb-4 rounded-lg border bg-card px-3 py-1.25"
					/>
					<div className="flex gap-4">
						<Button
							onClick={() => setEditOpen(false)}
							className="basis-1/2 bg-secondary/80 hover:bg-secondary"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button onClick={updateUsername} className="basis-1/2">
							Save
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</Main>
	);
}
