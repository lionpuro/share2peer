import type { SignalingServer } from "#/lib/server";
import { createContext } from "react";

export const SignalingServerContext = createContext<
	SignalingServer | undefined
>(undefined);
