import { useState, type KeyboardEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRoom } from "#/hooks/use-room";
import { Main } from "#/components/ui/main";
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
	const { createRoom } = useRoom();
	const [joinCode, setJoinCode] = useState("");
	const [creating, setCreating] = useState(false);

	async function handleCreate() {
		setCreating(true);
		try {
			const id = await createRoom();
			navigate({ to: "/s/$id", params: { id } });
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
		navigate({ to: "/s/$id", params: { id: joinCode } });
	}

	return (
		<>
			<Main className="min-h-[calc(100vh-3.75rem)] max-w-screen-lg">
				<div className="my-12 flex gap-8 max-md:mx-auto max-md:max-w-md max-md:flex-col md:my-auto md:pb-16">
					<div className="flex flex-wrap gap-x-4 gap-y-3 md:my-auto">
						<Heading order={1} className="mb-1 w-full md:mb-2 lg:text-5xl">
							Seamless file sharing in your browser
						</Heading>
						<div className="w-full text-secondary-foreground/80 md:mt-auto">
							<p>Send files to any device with only a web browser.</p>
							<p>No registration, no install, no cloud.</p>
						</div>
						<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
							<IconConnect />
							Peer-to-peer
						</span>
						<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
							<IconDevices />
							Cross-platform
						</span>
						<span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground/80">
							<IconInfinity />
							No size limits
						</span>
					</div>
					<div className="flex w-full flex-col gap-4 rounded-xl border p-6 max-md:mx-auto max-md:mt-12 md:ml-auto md:max-w-sm">
						<span className="text-sm">Create a room to send files</span>
						<Button
							onClick={handleCreate}
							className="gap-1"
							disabled={creating}
						>
							<IconPlus />
							New Room
						</Button>
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground/70 before:h-0.5 before:flex-1 before:bg-neutral-200 before:content-['_'] after:h-0.5 after:flex-1 after:bg-neutral-200 after:content-['_']">
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
					</div>
				</div>
			</Main>
			<Footer />
		</>
	);
}
