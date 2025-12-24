import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";
import { Slide, ToastContainer, type ToastOptions } from "react-toastify";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const toastOptions: ToastOptions = {
	position: "top-right",
	autoClose: 5000,
	hideProgressBar: true,
	closeOnClick: true,
	pauseOnHover: true,
	pauseOnFocusLoss: false,
	theme: "light",
	className: "",
	transition: Slide,
};

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ToastContainer {...toastOptions} />
		<RouterProvider router={router} />
	</StrictMode>,
);
