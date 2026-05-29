import { createFileRoute, Link } from "@tanstack/react-router";
import { Main } from "#/components/ui/main";
import {
	IconConnect,
	IconDevices,
	IconGithub,
	IconInfinity,
} from "#/components/icons";
import { useNotifications } from "#/hooks/use-notifications";

export const Route = createFileRoute("/")({
	component: Component,
});

function Component() {
	useNotifications();
	return (
		<>
			<Main className="min-h-[calc(100vh-3.5rem)] max-w-screen-lg">
				<div className="mx-auto mt-24 mb-12 flex flex-col items-center gap-4">
					<div className="flex flex-col items-center text-center">
						<h1 className="mb-2 w-full text-3xl leading-none font-bold tracking-tight text-balance md:mb-2 md:text-4xl">
							Quick file sharing for every device
						</h1>
						<p className="mb-2 text-balance text-foreground/80 md:mt-auto">
							Private file transfers without size limits. No setup, no accounts.
							100% free.
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
					<div className="mx-auto flex gap-2">
						<Link
							to="/app"
							className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-darker"
						>
							Start sharing
						</Link>
						<a
							href="https://github.com/lionpuro/websend"
							rel="noopener noreferrer"
							className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
						>
							<IconGithub />
							View on Github
						</a>
					</div>
				</div>
			</Main>
		</>
	);
}
