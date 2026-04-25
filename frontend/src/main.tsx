import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "#/routeTree.gen";
import { ThemeProvider } from "#/context/theme/provider";
import { ToastContainer } from "#/components/toast";
import { SignalingServerProvider } from "#/context/signaling/provider";
import { createServer } from "#/lib/server";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const server = createServer();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider>
			<ToastContainer />
			<SignalingServerProvider server={server}>
				<RouterProvider router={router} />
			</SignalingServerProvider>
		</ThemeProvider>
	</StrictMode>,
);
