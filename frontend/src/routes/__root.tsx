import { Header } from "#/components/header";
import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<Header />
			<Outlet />
		</>
	);
}
