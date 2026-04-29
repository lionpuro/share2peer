import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "#/routeTree.gen";
import { ThemeProvider } from "#/context/theme/provider";
import { ToastContainer } from "#/components/toast";
import { createSignalingClient } from "#/lib/signaling/client";
import { SignalingClientProvider } from "#/context/signaling/provider";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const socketURL: string = (() => {
	const { VITE_WS_PROTOCOL, VITE_WS_HOST, VITE_WS_ENDPOINT } = import.meta.env;
	const host = VITE_WS_HOST.startsWith("localhost:")
		? new URL(import.meta.url).host
		: VITE_WS_HOST;
	return new URL(VITE_WS_ENDPOINT, `${VITE_WS_PROTOCOL}://${host}`).toString();
})();

const client = createSignalingClient(socketURL);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider>
			<ToastContainer />
			<SignalingClientProvider client={client}>
				<RouterProvider router={router} />
			</SignalingClientProvider>
		</ThemeProvider>
	</StrictMode>,
);
