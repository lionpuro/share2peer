import { Link } from "@tanstack/react-router";
import { IconGithub, IconAccessPoint } from "#/components/icons";

export function Header() {
	return (
		<header className="mx-auto flex w-full max-w-screen-lg items-center px-6 py-4 sm:px-8">
			<Link to="/" className="flex items-center gap-1 text-xl font-bold">
				<IconAccessPoint className="text-primary size-8" />
				share2peer
			</Link>
			<div className="ml-auto flex">
				<a
					href="https://github.com/lionpuro/share2peer"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 font-medium text-secondary-foreground/90"
				>
					<IconGithub />
					Source
				</a>
			</div>
		</header>
	);
}
