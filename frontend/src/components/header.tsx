import { Link } from "@tanstack/react-router";
import { IconAccessPoint } from "#/components/icons";

export function Header() {
	return (
		<header className="mx-auto flex w-full max-w-screen-xl items-center px-6 py-4 sm:px-8">
			<Link to="/" className="flex items-center gap-1 font-semibold">
				<IconAccessPoint className="size-6 text-primary" />
				WebSend
			</Link>
		</header>
	);
}
