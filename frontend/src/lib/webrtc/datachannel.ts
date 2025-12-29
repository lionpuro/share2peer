import * as z from "zod/mini";
import { FileMetadataSchema } from "#/lib/file";
import { PACKET_SIZE } from "./protocol";

export type DataChannelType = "signal" | `file-${string}`;

export const SignalChannelEvents = {
	ShareFiles: "share-files",
	RequestFile: "request-file",
	CancelShare: "cancel-share",
	StopTransfer: "stop-transfer",
	ReadyToReceive: "ready-to-receive",
} as const;

export type SignalChannelMessageType =
	(typeof SignalChannelEvents)[keyof typeof SignalChannelEvents];

export const ShareFilesSchema = z.object({
	type: z.literal(SignalChannelEvents.ShareFiles),
	payload: z.object({ files: z.array(FileMetadataSchema) }),
});

export type ShareFilesMessage = z.infer<typeof ShareFilesSchema>;

export const RequestFileSchema = z.object({
	type: z.literal(SignalChannelEvents.RequestFile),
	payload: z.object({ file_id: z.string() }),
});

export type RequestFileMessage = z.infer<typeof RequestFileSchema>;

export const CancelShareSchema = z.object({
	type: z.literal(SignalChannelEvents.CancelShare),
});

export type CancelShareMessage = z.infer<typeof CancelShareSchema>;

export const StopTransferMessageSchema = z.object({
	type: z.literal(SignalChannelEvents.StopTransfer),
	payload: z.object({ id: z.string() }),
});

export type StopTransferMessage = z.infer<typeof StopTransferMessageSchema>;

export const ReadyToReceiveSchema = z.object({
	type: z.literal(SignalChannelEvents.ReadyToReceive),
	payload: z.object({ client_id: z.string() }),
});

export type ReadyToReceiveMessage = z.infer<typeof ReadyToReceiveSchema>;

export type SignalChannelMessage =
	| ShareFilesMessage
	| RequestFileMessage
	| CancelShareMessage
	| StopTransferMessage
	| ReadyToReceiveMessage;

export function sendSignal(
	chan: RTCDataChannel | undefined,
	msg: SignalChannelMessage,
) {
	if (!chan) {
		console.warn("data channel doesn't exist");
		return;
	}
	chan.send(JSON.stringify(msg));
}

export async function sendPacket(
	chan: RTCDataChannel,
	packet: ArrayBuffer,
): Promise<void> {
	await waitToFreeBuffer(chan);
	chan.send(packet);
}

function waitToFreeBuffer(chan: RTCDataChannel): Promise<void> {
	chan.bufferedAmountLowThreshold = PACKET_SIZE;
	return new Promise((resolve) => {
		const threshold = PACKET_SIZE * 8;
		if (chan.bufferedAmount < threshold) {
			return resolve();
		}
		const handler = () => {
			if (chan.bufferedAmount < threshold) {
				chan.removeEventListener("bufferedamountlow", handler);
				resolve();
			}
		};
		chan.addEventListener("bufferedamountlow", handler);
		// fallback resolve after a timeout
		setTimeout(resolve, 2000);
	});
}
