import { Link } from "@tanstack/react-router";
import { IconAccessPoint } from "#/components/icons";

export function Header() {
	return (
		<header className="mx-auto flex w-full max-w-screen-lg items-center px-6 py-4 sm:px-8">
			<Link to="/" className="flex items-center gap-1 text-xl font-bold">
				<IconAccessPoint className="size-8 text-primary" />
				share2peer
			</Link>
		</header>
	);
}
