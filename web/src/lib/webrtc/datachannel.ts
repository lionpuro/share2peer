import * as z from "zod/mini";
import { FileMetadataSchema } from "../file";
import { MESSAGE_SIZE } from "../constants";

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

type MessageQueueMessage = string | ArrayBuffer;

export class DataChannelMessageQueue {
	#channel: RTCDataChannel;
	#queue: MessageQueueMessage[] = [];
	#sending = false;
	#onSend?: (message: MessageQueueMessage) => void;

	constructor(
		channel: RTCDataChannel,
		onSend?: (message: MessageQueueMessage) => void,
	) {
		channel.bufferedAmountLowThreshold = MESSAGE_SIZE;
		this.#channel = channel;
		this.#onSend = onSend;
	}

	enqueue(msg: MessageQueueMessage) {
		this.#queue.push(msg);
		this.flush();
	}

	private async flush() {
		if (this.#sending) {
			return;
		}
		this.#sending = true;

		while (this.#queue.length > 0) {
			if (!this.#sending) {
				return;
			}
			await waitToFreeBuffer(this.#channel);
			const next = this.#queue.shift();
			if (!next) return;
			try {
				if (next instanceof ArrayBuffer) {
					this.#channel.send(next);
				} else {
					this.#channel.send(next);
				}
				this.#onSend?.(next);
			} catch (err) {
				console.error(err);
			}
		}
		this.#sending = false;
	}

	stop() {
		this.#sending = false;
	}
}

function waitToFreeBuffer(chan: RTCDataChannel): Promise<void> {
	return new Promise((resolve) => {
		const threshold = MESSAGE_SIZE * 8;
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
