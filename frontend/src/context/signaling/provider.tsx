import type { ReactNode } from "react";
import type { SignalingClient } from "#/lib/signaling/client";
import { SignalingClientContext } from "./context";

export function SignalingClientProvider({
	client,
	children,
}: {
	client: SignalingClient;
	children: ReactNode;
}) {
	return (
		<SignalingClientContext.Provider value={client}>
			{children}
		</SignalingClientContext.Provider>
	);
}
