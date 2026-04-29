import type { SignalingClient } from "#/lib/signaling/client";
import { createContext } from "react";

export const SignalingClientContext = createContext<
	SignalingClient | undefined
>(undefined);
