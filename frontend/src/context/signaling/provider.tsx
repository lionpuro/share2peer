import { type ReactNode } from "react";
import type { SignalingServer } from "#/lib/server";
import { SignalingServerContext } from "./context";

export function SignalingServerProvider({
	server,
	children,
}: {
	server: SignalingServer;
	children: ReactNode;
}) {
	return (
		<SignalingServerContext.Provider value={server}>
			{children}
		</SignalingServerContext.Provider>
	);
}
