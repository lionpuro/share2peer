import { useContext } from "react";
import {
	Slide,
	ToastContainer as ToastifyToastContainer,
	type ToastContentProps,
	type ToastOptions,
} from "react-toastify";
import type { SignalingEvent } from "#/lib/signaling/client";
import { getPreferredTheme, ThemeContext } from "#/context/theme/context";
import { Button } from "#/components/ui/button";

const options: ToastOptions = {
	position: "top-right",
	autoClose: 5000,
	hideProgressBar: true,
	closeOnClick: false,
	pauseOnHover: true,
	pauseOnFocusLoss: false,
	transition: Slide,
};

export function ToastContainer() {
	const { theme } = useContext(ThemeContext);
	return (
		<ToastifyToastContainer
			{...options}
			theme={theme === "system" ? getPreferredTheme() : theme}
		/>
	);
}

type InvitationProps = Partial<ToastContentProps> & {
	invitation: SignalingEvent<"room-invitation">["payload"];
};

export function InviteNotification({
	invitation,
	closeToast,
}: InvitationProps) {
	const user = invitation.from;
	return (
		<div className="flex w-full flex-col gap-2">
			<p className="w-full leading-none font-bold text-foreground">
				Room invitation
			</p>
			<p className="w-full text-sm font-medium">
				{`${user.username} (${user.device_name}) has invited you to a room.`}
			</p>
			<div className="flex gap-2">
				<Button
					variant="ghost"
					onClick={() => closeToast?.("decline")}
					className="basis-1/2 border py-1.5 text-destructive hover:bg-secondary/40"
				>
					Decline
				</Button>
				<Button
					onClick={() => closeToast?.("accept")}
					className="basis-1/2 py-1.75"
				>
					Join
				</Button>
			</div>
		</div>
	);
}
