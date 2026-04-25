import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import type { ServerEventMap } from "#/lib/server";
import { useSignalingServer } from "./signaling";
import { InviteNotification } from "#/components/toast";

export function useNotifications() {
	const navigate = useNavigate();
	const server = useSignalingServer();
	useEffect(() => {
		const handler = (e: ServerEventMap["room-invitation"]) => {
			toast(<InviteNotification invitation={e.detail} />, {
				autoClose: false,
				closeButton: false,
				className: "p-0",
				onClose: (reason) => {
					if (reason === "accept") {
						navigate({ to: "/r/$id", params: { id: e.detail.room_id } });
					}
				},
			});
		};
		server.addEventListener("room-invitation", handler);
		return () => {
			server.removeEventListener("room-invitation", handler);
		};
	}, [navigate, server]);
}
