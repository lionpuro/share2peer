import { Link } from "@tanstack/react-router";
import { Logo } from "#/components/icons";

export function Header() {
	return (
		<header className="mx-auto flex w-full max-w-screen-lg items-center px-6 py-3 sm:px-8">
			<Link to="/" className="flex items-center gap-1 text-lg font-semibold">
				<Logo className="size-6.5 text-primary" />
				WebSend
			</Link>
		</header>
	);
}
