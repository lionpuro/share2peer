import * as z from "zod/mini";
import { FileMetadataSchema } from "../file";

export const DataChannelEvents = {
	ShareFiles: "share-files",
	RequestFile: "request-file",
	CancelShare: "cancel-share",
	ReadyToReceive: "ready-to-receive",
} as const;

export type DataChannelMessageType =
	(typeof DataChannelEvents)[keyof typeof DataChannelEvents];

export const ShareFilesSchema = z.object({
	type: z.literal(DataChannelEvents.ShareFiles),
	payload: z.object({ files: z.array(FileMetadataSchema) }),
});

export type ShareFilesMessage = z.infer<typeof ShareFilesSchema>;

export const RequestFileSchema = z.object({
	type: z.literal(DataChannelEvents.RequestFile),
	payload: z.object({ file_id: z.string() }),
});

export type RequestFileMessage = z.infer<typeof RequestFileSchema>;

export const CancelShareSchema = z.object({
	type: z.literal(DataChannelEvents.CancelShare),
});

export type CancelShareMessage = z.infer<typeof CancelShareSchema>;

export const ReadyToReceiveSchema = z.object({
	type: z.literal(DataChannelEvents.ReadyToReceive),
	payload: z.object({ client_id: z.string() }),
});

export type ReadyToReceiveMessage = z.infer<typeof ReadyToReceiveSchema>;

export type DataChannelMessage =
	| ShareFilesMessage
	| RequestFileMessage
	| CancelShareMessage
	| ReadyToReceiveMessage;

export function sendToChannel(
	chan: RTCDataChannel | undefined,
	msg: DataChannelMessage,
) {
	if (!chan) {
		console.warn("data channel doesn't exist");
		return;
	}
	chan.send(JSON.stringify(msg));
}
