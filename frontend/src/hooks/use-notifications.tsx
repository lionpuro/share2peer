import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import { subscribe } from "#/lib/signaling/client";
import { useSignalingClient } from "./signaling";
import { InviteNotification } from "#/components/toast";

export function useNotifications() {
	const navigate = useNavigate();
	const client = useSignalingClient();
	useEffect(() => {
		const unsubscribe = subscribe(client, "room-invitation", (e) => {
			toast(<InviteNotification invitation={e.payload} />, {
				autoClose: false,
				closeButton: false,
				className: "p-0",
				onClose: (reason) => {
					if (reason === "accept") {
						navigate({ to: "/r/$id", params: { id: e.payload.room_id } });
					}
				},
			});
		});
		return () => unsubscribe();
	}, [navigate, client]);
}
