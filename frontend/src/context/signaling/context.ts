import type { SignalingServer } from "#/lib/signaling/server";
import { createContext } from "react";

export const SignalingServerContext = createContext<
	SignalingServer | undefined
>(undefined);
