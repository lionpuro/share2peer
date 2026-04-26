import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import { subscribe } from "#/lib/signaling/server";
import { useSignalingServer } from "./signaling";
import { InviteNotification } from "#/components/toast";

export function useNotifications() {
	const navigate = useNavigate();
	const server = useSignalingServer();
	useEffect(() => {
		const unsubscribe = subscribe(server, "room-invitation", (e) => {
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
		});
		return () => unsubscribe();
	}, [navigate, server]);
}
