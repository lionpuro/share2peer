import { useRef, useState } from "react";
import { cn } from "#/lib/helper";
import type { Room, User } from "#/lib/schemas";
import type { PeerState } from "#/stores/peer";
import { setSessionData } from "#/stores/signaling";
import { Heading } from "#/components/ui/heading";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import {
	IconAccountGroup,
	IconCheck,
	IconCopy,
	IconLink,
	IconPencil,
	IconShare,
} from "#/components/icons";

export function RoomArea({
	identity,
	room,
	peers,
}: {
	identity: User;
	room: Room;
	peers: Record<string, PeerState>;
}) {
	const users: PeerState[] =
		room.users
			?.filter((u) => u.id !== identity.id)
			.map((u) => {
				return peers[u.id] || { ...u, connectionState: "disconnected" };
			}) || [];

	const [editOpen, setEditOpen] = useState(false);
	const [copiedURL, setCopiedURL] = useState(false);
	const roomURL = `${window.location.protocol}//${window.location.host}/r/${room.id}`;
	const usernameRef = useRef<HTMLInputElement>(null);

	function copyURL() {
		setCopiedURL(true);
		navigator.clipboard.writeText(roomURL);
		setTimeout(() => {
			setCopiedURL(false);
		}, 1000);
	}

	const supportsShare = typeof navigator.share === "function";

	function shareURL() {
		if (supportsShare) {
			navigator.share({ url: roomURL });
		}
	}

	function updateUsername() {
		const username = usernameRef.current?.value;
		if (!username) return;
		setSessionData({ username });
		window.location.reload();
	}

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="flex gap-2">
					<span className="flex size-9.5 items-center justify-center rounded-lg bg-primary/20 text-lg text-primary">
						<IconAccountGroup />
					</span>
					<div className="flex flex-col">
						<Heading order={2}>Room</Heading>
						<p className="text-sm text-muted-foreground">{`ID: ${room.id}`}</p>
					</div>
					{!supportsShare && (
						<Button
							onClick={copyURL}
							className="ml-auto gap-1.5 py-1.75 disabled:text-white"
						>
							<span className="max-sm:hidden">
								{!copiedURL ? <IconLink /> : <IconCheck />}
							</span>
							{!copiedURL ? "Copy link" : "Copied"}
						</Button>
					)}
				</div>
				<ul className="flex flex-col gap-2">
					<li key={identity.id} className="flex items-center gap-3">
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
								<span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
									YOU
								</span>
							</div>
							<span className="text-sm leading-none font-medium text-muted-foreground">
								{identity.device_name}
							</span>
						</div>
					</li>
					{users.map((u) => (
						<li key={"user-" + u.id} className="flex items-center gap-3">
							<div className="flex flex-1 flex-col justify-between">
								<div className="flex items-center leading-none">
									{u.username}
									<span
										title={u.connectionState}
										className={cn(
											"ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold before:text-[8px] before:leading-none before:content-['●']",
											{
												"bg-neutral-200/80 text-neutral-700/80 dark:text-muted-foreground":
													u.connectionState === "disconnected",
												"bg-green-100 text-green-700/80 dark:text-green-500":
													u.connectionState === "connected",
												"bg-yellow-100 text-yellow-700/80 dark:text-yellow-500":
													u.connectionState === "connecting",
												"bg-red-100 text-red-700/80 dark:text-red-500":
													u.connectionState === "failed",
											},
											"dark:border dark:bg-muted dark:py-0.25",
										)}
									>
										{u.connectionState}
									</span>
								</div>
								<span className="text-sm leading-none font-medium text-muted-foreground">
									{u.device_name}
								</span>
							</div>
						</li>
					))}
				</ul>
				{supportsShare && (
					<div className="mt-2 flex gap-3">
						<Button
							variant="ghost"
							onClick={shareURL}
							className="basis-1/2 gap-1.5 border border-primary py-1.5 text-primary"
						>
							<IconShare />
							Share link
						</Button>
						<Button
							disabled={copiedURL}
							onClick={copyURL}
							title="Copy"
							className="basis-1/2 gap-1.5 px-3 py-1.75 disabled:bg-primary disabled:text-white disabled:hover:bg-primary-darker"
						>
							{!copiedURL ? (
								<>
									<IconCopy className="text-xs" />
									Copy link
								</>
							) : (
								<>
									<IconCheck className="text-xs" />
									Copied
								</>
							)}
						</Button>
					</div>
				)}
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
		</>
	);
}
