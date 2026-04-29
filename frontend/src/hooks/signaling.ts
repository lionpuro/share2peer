import { useContext } from "react";
import { SignalingClientContext } from "#/context/signaling/context";

export function useSignalingClient() {
	const ctx = useContext(SignalingClientContext);
	if (!ctx) {
		throw new Error("hook can only be used within context provider");
	}
	return ctx;
}
