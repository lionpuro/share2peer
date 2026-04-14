import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import { getServer, type ServerEventMap } from "#/lib/server";
import { InviteNotification } from "#/components/toast";

export function useNotifications() {
	const navigate = useNavigate();
	useEffect(() => {
		const server = getServer();
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
	}, [navigate]);
}
