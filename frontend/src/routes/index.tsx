import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSocket } from "#/hooks/use-socket";
import { useSession } from "#/hooks/use-session";
import { Main } from "#/components/ui/main";
import { Loader } from "#/components/ui/loader";
import { Button } from "#/components/ui/button";
import { Heading } from "#/components/ui/heading";
import { Footer } from "#/components/footer";
import {
	IconConnect,
	IconDevices,
	IconInfinity,
	IconPlus,
	IconX,
} from "#/components/icons";
import { toast } from "react-toastify";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const navigate = useNavigate();
	const { connectionState } = useSocket();
	const { session, createSession, leaveSession } = useSession();
	const [joinCode, setJoinCode] = useState("");

	async function handleCreate() {
		try {
			const id = await createSession();
			navigate({ to: "/s/$id", params: { id } });
		} catch (err) {
			console.error("create session:", err);
			toast.error("Failed to create session");
		}
	}

	useEffect(() => {
		if (session) {
			leaveSession();
		}
	}, [session, leaveSession]);

	if (connectionState !== "open" && connectionState !== "error") {
		return <Loader />;
	}
	if (connectionState === "error") {
		return (
			<Main>
				<p className="text-center">Connection error</p>
			</Main>
		);
	}

	return (
		<>
			<Main className="min-h-screen">
				<div className="mx-auto my-12 flex max-w-lg flex-wrap gap-x-4 gap-y-3">
					<Heading order={1} className="mb-1 w-full">
						Share files quickly and privately
					</Heading>
					<p className="w-full text-secondary-foreground/80">
						Transfer files between devices without storing them in the cloud.
					</p>
					<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
						<IconConnect />
						Peer-to-peer
					</span>
					<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
						<IconInfinity />
						No size limits
					</span>
					<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
						<IconDevices />
						Cross-platform
					</span>
				</div>
				<div className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-4">
					<Heading order={2}>Join session</Heading>
					<div className="flex items-center gap-2">
						<div className="relative flex flex-1">
							<input
								id="input-code"
								placeholder="ABC123"
								minLength={6}
								maxLength={6}
								value={joinCode}
								onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
								className="w-full rounded-lg border border-secondary px-2 py-1.25 font-mono placeholder:text-neutral-400"
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
							to="/s/$id"
							params={{ id: joinCode }}
							className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${joinCode.length !== 6 ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-primary-darker"}`}
							disabled={joinCode.length !== 6}
						>
							Join
						</Link>
					</div>
					<span className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground before:h-0.5 before:flex-1 before:bg-neutral-200 before:content-['_'] after:h-0.5 after:flex-1 after:bg-neutral-200 after:content-['_']">
						OR
					</span>
					<Button onClick={handleCreate} className="gap-1">
						<IconPlus />
						Create session
					</Button>
				</div>
			</Main>
			<Footer />
		</>
	);
}
