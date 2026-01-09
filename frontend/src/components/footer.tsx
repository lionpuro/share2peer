import { Link } from "@tanstack/react-router";
import { IconAccessPoint, IconGithub } from "./icons";

export function Footer() {
	return (
		<footer className="flex border-t border-secondary bg-card py-6">
			<div className="mx-auto flex w-full max-w-screen-lg px-6 sm:px-8">
				<Link to="/" className="flex items-center gap-1 font-medium">
					<IconAccessPoint className="size-6 text-primary" />
					share2peer
				</Link>
				<a
					href="https://github.com/lionpuro/share2peer"
					target="_blank"
					rel="noopener noreferrer"
					className="ml-auto flex items-center gap-1 text-sm font-medium text-muted-foreground"
				>
					<IconGithub />
					Github
				</a>
			</div>
		</footer>
	);
}
