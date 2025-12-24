import { Header } from "#/components/header";
import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<>
			<Header />
			<Outlet />
		</>
	);
}
