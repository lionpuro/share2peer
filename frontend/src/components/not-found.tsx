import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<div className="my-16 flex flex-col items-center">
			<span className="mb-2 text-5xl font-bold">404</span>
			<h1 className="mb-4">Page not found</h1>
			<Link
				to="/"
				className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-darker"
			>
				Home
			</Link>
		</div>
	);
}
