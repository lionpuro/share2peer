import { useContext } from "react";
import { SignalingServerContext } from "#/context/signaling/context";

export function useSignalingServer() {
	const ctx = useContext(SignalingServerContext);
	if (!ctx) {
		throw new Error("hook can only be used within context provider");
	}
	return ctx;
}
