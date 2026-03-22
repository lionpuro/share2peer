import { useEffect, useState, type KeyboardEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { toast, type ToastContentProps } from "react-toastify";
import { createRoom } from "#/lib/room";
import { server, type ServerEventMap } from "#/lib/server";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	const navigate = useNavigate();
	const [joinCode, setJoinCode] = useState("");
	const [creating, setCreating] = useState(false);
	useInvitationListener();

	async function handleCreate() {
		setCreating(true);
		try {
			const { id } = await createRoom(server);
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
				<div className="my-12 flex gap-8 max-md:mx-auto max-md:flex-col md:my-auto md:pb-16">
					<div className="flex flex-wrap gap-x-4 gap-y-3 md:my-auto">
						<Heading order={1} className="mb-1 w-full md:mb-2 lg:text-5xl">
							Seamless file sharing in your browser
						</Heading>
						<div className="w-full text-secondary-foreground/80 md:mt-auto">
							<p>
								Send files to any device with only a web browser. No
								registration, no installation. To get started, create a room and
								invite another person or device.
							</p>
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
					<div className="flex w-full flex-col gap-4 rounded-xl border bg-card p-6 max-md:mx-auto max-md:mt-12 sm:max-w-sm md:ml-auto md:min-w-xs">
						<span className="text-sm">
							Create a private room to start sharing
						</span>
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

type InvitationProps = Partial<ToastContentProps> & {
	invitation: ServerEventMap["room-invitation"]["detail"];
};

function Invitation({ invitation, closeToast }: InvitationProps) {
	const user = invitation.from;
	return (
		<div className="flex flex-col gap-2">
			<p className="w-full leading-none font-bold text-foreground">
				Room invitation
			</p>
			<p className="w-full text-sm font-medium">{`${user.display_name} (${user.device_name}) has invited you to a room.`}</p>
			<div className="flex gap-2">
				<Button
					variant="ghost"
					onClick={() => closeToast?.("decline")}
					className="basis-1/2 border py-1.5 text-destructive hover:bg-secondary/40"
				>
					Decline
				</Button>
				<Button
					onClick={() => closeToast?.("accept")}
					className="basis-1/2 py-1.75"
				>
					Join
				</Button>
			</div>
		</div>
	);
}

function useInvitationListener() {
	const navigate = useNavigate();
	useEffect(() => {
		const handler = (e: ServerEventMap["room-invitation"]) => {
			toast(<Invitation invitation={e.detail} />, {
				autoClose: false,
				closeButton: false,
				className: "p-0 border shadow-none !rounded-xl",
				onClose: (reason) => {
					if (reason === "accept") {
						navigate({ to: "/s/$id", params: { id: e.detail.room_id } });
					}
				},
			});
		};
		server.addEventListener("room-invitation", handler);
		return () => {
			server.removeEventListener("room-invitation", handler);
		};
	}, [navigate]);
}
